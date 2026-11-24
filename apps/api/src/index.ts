import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppContext, Env } from "./types";
import { authRoutes } from "./routes/auth";
import { settingsRoutes } from "./routes/settings";
import { catalogRoutes } from "./routes/catalog";
import { supplierRoutes } from "./routes/suppliers";
import { unitRoutes } from "./routes/units";
import { customerRoutes } from "./routes/customers";
import { salesRoutes } from "./routes/sales";
import { paymentRoutes } from "./routes/payments";
import { dashboardRoutes } from "./routes/dashboard";
import { reportRoutes } from "./routes/reports";
import { auditRoutes } from "./routes/audit";
import { accountRoutes } from "./routes/accounts";
import { expenseRoutes } from "./routes/expenses";
import { requireAuth } from "./middleware/auth";
import { createDb } from "./db";
import {
  showrooms,
  users,
  brands,
  models,
  suppliers,
  supplierTransactions,
  units,
  customers,
  sales,
  installmentPlans,
  installmentSchedules,
  payments,
  paymentAllocations,
  counters,
  auditLogs,
} from "@aev/shared";
import { eq, and, lt, sql } from "drizzle-orm";

const app = new Hono<AppContext>();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Global Error Handler
app.onError((err, c) => {
  console.error("Unhandled API Error:", err);
  return c.json(
    {
      error: err.message || "Internal Server Error",
    },
    500
  );
});

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    environment: c.env.ENVIRONMENT || "local",
    timestamp: new Date().toISOString(),
  });
});

// Auth Routes (Public login + protected me/users)
app.route("/api/auth", authRoutes);

// Protected Core Routes
const protectedApi = new Hono<AppContext>();
protectedApi.use("*", requireAuth);

protectedApi.route("/dashboard", dashboardRoutes);
protectedApi.route("/reports", reportRoutes);
protectedApi.route("/audit", auditRoutes);
protectedApi.route("/accounts", accountRoutes);
protectedApi.route("/expenses", expenseRoutes);
protectedApi.route("/settings", settingsRoutes);
protectedApi.route("/catalog", catalogRoutes);
protectedApi.route("/suppliers", supplierRoutes);
protectedApi.route("/units", unitRoutes);
protectedApi.route("/customers", customerRoutes);
protectedApi.route("/sales", salesRoutes);
protectedApi.route("/payments", paymentRoutes);

app.route("/api", protectedApi);

// Cloudflare Workers Scheduled Event (Cron triggers)
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log(`Cron triggered at ${new Date().toISOString()}: ${event.cron}`);
    const db = createDb(env.DB);

    // 1. Daily Installment Due & Overdue Check + Fine Computation (5 19 * * * UTC = 00:05 PKT)
    if (event.cron === "5 19 * * *") {
      ctx.waitUntil(
        (async () => {
          try {
            const now = new Date();
            const nowSeconds = Math.floor(now.getTime() / 1000);

            // Fetch all showrooms to get their fine settings
            const allShowrooms = await db.select().from(showrooms);

            for (const sr of allShowrooms) {
              // Find all pending / partially_paid schedules where due date has passed
              const overdueSchedules = await db
                .select()
                .from(installmentSchedules)
                .where(
                  and(
                    eq(installmentSchedules.showroomId, sr.id),
                    sql`${installmentSchedules.status} IN ('pending', 'partially_paid')`,
                    lt(installmentSchedules.dueDate, now)
                  )
                );

              for (const schedule of overdueSchedules) {
                const dueDateSeconds = Math.floor(schedule.dueDate.getTime() / 1000);
                const daysOverdue = Math.floor((nowSeconds - dueDateSeconds) / 86400);

                let fineAmount = schedule.fineAmount;
                // Compute fine if enabled and grace days passed
                if (sr.lateFineEnabled && !schedule.fineWaived && daysOverdue > sr.lateFineGraceDays) {
                  if (sr.lateFineType === "fixed") {
                    fineAmount = sr.lateFineAmount || 0;
                  } else if (sr.lateFineType === "percentage") {
                    fineAmount = Math.round((schedule.amount * (sr.lateFineAmount || 0)) / 100);
                  }
                }

                await db
                  .update(installmentSchedules)
                  .set({
                    status: "overdue",
                    fineAmount,
                    updatedAt: now,
                  })
                  .where(eq(installmentSchedules.id, schedule.id));
              }

              console.log(
                `Showroom ${sr.name}: processed ${overdueSchedules.length} overdue installments.`
              );
            }
          } catch (err) {
            console.error("Daily installment cron error:", err);
          }
        })()
      );
    }

    // 2. Nightly Database Full Export to R2 with 30-day Retention (0 22 * * * UTC = 03:00 PKT)
    if (event.cron === "0 22 * * *") {
      ctx.waitUntil(
        (async () => {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const backupKey = `backups/db-export-${timestamp}.json`;

            // Export all tables to JSON bundle
            const [
              showroomsData,
              usersData,
              brandsData,
              modelsData,
              suppliersData,
              transactionsData,
              unitsData,
              customersData,
              salesData,
              plansData,
              schedulesData,
              paymentsData,
              allocationsData,
              countersData,
              auditData,
            ] = await Promise.all([
              db.select().from(showrooms),
              db.select({ id: users.id, showroomId: users.showroomId, email: users.email, role: users.role, fullName: users.fullName, phone: users.phone, isActive: users.isActive, createdAt: users.createdAt, updatedAt: users.updatedAt }).from(users),
              db.select().from(brands),
              db.select().from(models),
              db.select().from(suppliers),
              db.select().from(supplierTransactions),
              db.select().from(units),
              db.select().from(customers),
              db.select().from(sales),
              db.select().from(installmentPlans),
              db.select().from(installmentSchedules),
              db.select().from(payments),
              db.select().from(paymentAllocations),
              db.select().from(counters),
              db.select().from(auditLogs),
            ]);

            const exportPayload = {
              metadata: {
                exportedAt: new Date().toISOString(),
                version: "2.0",
                tablesCount: 15,
                recordsSummary: {
                  showrooms: showroomsData.length,
                  users: usersData.length,
                  brands: brandsData.length,
                  models: modelsData.length,
                  suppliers: suppliersData.length,
                  supplierTransactions: transactionsData.length,
                  units: unitsData.length,
                  customers: customersData.length,
                  sales: salesData.length,
                  installmentPlans: plansData.length,
                  installmentSchedules: schedulesData.length,
                  payments: paymentsData.length,
                  paymentAllocations: allocationsData.length,
                  counters: countersData.length,
                  auditLogs: auditData.length,
                },
              },
              data: {
                showrooms: showroomsData,
                users: usersData,
                brands: brandsData,
                models: modelsData,
                suppliers: suppliersData,
                supplierTransactions: transactionsData,
                units: unitsData,
                customers: customersData,
                sales: salesData,
                installmentPlans: plansData,
                installmentSchedules: schedulesData,
                payments: paymentsData,
                paymentAllocations: allocationsData,
                counters: countersData,
                auditLogs: auditData,
              },
            };

            await env.DOCUMENTS.put(backupKey, JSON.stringify(exportPayload), {
              customMetadata: {
                type: "db_full_export",
                exportedAt: new Date().toISOString(),
              },
            });
            console.log(`Full nightly D1 export saved: ${backupKey}`);

            // Prune backups older than 30 days
            const listResult = await env.DOCUMENTS.list({ prefix: "backups/" });
            const thirtyDaysAgo = Date.now() - 30 * 86400 * 1000;

            for (const obj of listResult.objects) {
              if (obj.uploaded && obj.uploaded.getTime() < thirtyDaysAgo) {
                await env.DOCUMENTS.delete(obj.key);
                console.log(`Pruned old backup: ${obj.key}`);
              }
            }
          } catch (err) {
            console.error("Nightly backup export failed:", err);
          }
        })()
      );
    }
  },
};
