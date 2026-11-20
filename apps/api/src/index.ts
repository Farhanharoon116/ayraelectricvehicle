import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppContext, Env } from "./types";
import { authRoutes } from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import { createDb } from "./db";
import { installmentSchedules } from "@aev/shared";
import { eq, and, lt } from "drizzle-orm";

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

// Mount Routes
app.route("/api/auth", authRoutes);

// Protected routes will be mounted in subsequent phases (catalog, units, sales, payments, settings, reports)
const protectedApi = new Hono<AppContext>();
protectedApi.use("*", requireAuth);
app.route("/api", protectedApi);

// Cloudflare Workers Scheduled Event (Cron triggers)
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log(`Cron triggered at ${new Date().toISOString()}: ${event.cron}`);
    const db = createDb(env.DB);

    // 1. Daily Installment Due & Overdue Check (5 19 * * * UTC = 00:05 PKT)
    if (event.cron === "5 19 * * *") {
      ctx.waitUntil(
        (async () => {
          const now = new Date();
          // Find all pending schedules where due date is before now
          const overdueSchedules = await db
            .select()
            .from(installmentSchedules)
            .where(
              and(
                eq(installmentSchedules.status, "pending"),
                lt(installmentSchedules.dueDate, now)
              )
            );

          for (const item of overdueSchedules) {
            await db
              .update(installmentSchedules)
              .set({ status: "overdue", updatedAt: new Date() })
              .where(eq(installmentSchedules.id, item.id));
          }

          console.log(`Processed ${overdueSchedules.length} overdue installments.`);
        })()
      );
    }

    // 2. Nightly Database Export to R2 (0 22 * * * UTC = 03:00 PKT)
    if (event.cron === "0 22 * * *") {
      ctx.waitUntil(
        (async () => {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const backupKey = `backups/db-export-${timestamp}.json`;
            // Export metadata / placeholder bundle to R2
            const backupInfo = {
              exportedAt: new Date().toISOString(),
              version: "1.0",
              note: "Nightly automated D1 export",
            };
            await env.DOCUMENTS.put(backupKey, JSON.stringify(backupInfo, null, 2), {
              customMetadata: { type: "db_backup" },
            });
            console.log(`Nightly backup stored at ${backupKey}`);
          } catch (err) {
            console.error("Nightly backup failed:", err);
          }
        })()
      );
    }
  },
};
