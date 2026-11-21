import { Hono } from "hono";
import { eq, and, sql, asc } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import {
  units,
  models,
  brands,
  sales,
  payments,
  installmentSchedules,
  installmentPlans,
} from "@aev/shared";

export const dashboardRoutes = new Hono<AppContext>();

dashboardRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);
  const now = new Date();

  // 1. Units in stock breakdown
  const stockRows = await db
    .select({
      brandName: brands.name,
      modelName: models.name,
      count: sql<number>`COUNT(${units.id})`,
    })
    .from(units)
    .innerJoin(models, eq(units.modelId, models.id))
    .innerJoin(brands, eq(models.brandId, brands.id))
    .where(and(eq(units.showroomId, user.showroomId), eq(units.status, "in_stock")))
    .groupBy(brands.name, models.name)
    .orderBy(brands.name, models.name);

  const totalInStock = stockRows.reduce((acc, row) => acc + Number(row.count), 0);

  // 2. Sales this month (Asia/Karachi: UTC+5)
  // Compute start of current month in UTC
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const [salesMonthStat] = await db
    .select({
      count: sql<number>`COUNT(${sales.id})`,
      totalAmount: sql<number>`COALESCE(SUM(${sales.totalAmount}), 0)`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.showroomId, user.showroomId),
        eq(sales.isVoided, false),
        sql`${sales.saleDate} >= ${Math.floor(startOfMonth.getTime() / 1000)}`
      )
    );

  // 3. Cash / payments collected today (last 24 hours / from start of today in PKT)
  const todayPKT = new Date(now.getTime() + 5 * 3600 * 1000);
  const startOfTodayPKT = new Date(Date.UTC(todayPKT.getUTCFullYear(), todayPKT.getUTCMonth(), todayPKT.getUTCDate(), 0, 0, 0));
  const startOfTodayUTCSeconds = Math.floor((startOfTodayPKT.getTime() - 5 * 3600 * 1000) / 1000);

  const [collectedTodayStat] = await db
    .select({
      count: sql<number>`COUNT(${payments.id})`,
      totalAmount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.showroomId, user.showroomId),
        sql`${payments.paymentDate} >= ${startOfTodayUTCSeconds}`
      )
    );

  // 4. Overdue installments
  const overdueList = await db
    .select({
      scheduleId: installmentSchedules.id,
      installmentNumber: installmentSchedules.installmentNumber,
      dueDate: installmentSchedules.dueDate,
      amount: installmentSchedules.amount,
      fineAmount: installmentSchedules.fineAmount,
      fineWaived: installmentSchedules.fineWaived,
      status: installmentSchedules.status,
      saleId: sales.id,
      invoiceNumber: sales.invoiceNumber,
      customerName: sales.customerNameSnap,
      customerPhone: sales.customerPhoneSnap,
      unitBrand: sales.unitBrandSnap,
      unitModel: sales.unitModelSnap,
    })
    .from(installmentSchedules)
    .innerJoin(installmentPlans, eq(installmentSchedules.installmentPlanId, installmentPlans.id))
    .innerJoin(sales, eq(installmentPlans.saleId, sales.id))
    .where(
      and(
        eq(installmentSchedules.showroomId, user.showroomId),
        eq(sales.isVoided, false),
        eq(installmentSchedules.status, "overdue")
      )
    )
    .orderBy(asc(installmentSchedules.dueDate))
    .limit(20);

  // 5. Installments due today
  const endOfTodayUTCSeconds = startOfTodayUTCSeconds + 86400;
  const dueTodayList = await db
    .select({
      scheduleId: installmentSchedules.id,
      installmentNumber: installmentSchedules.installmentNumber,
      dueDate: installmentSchedules.dueDate,
      amount: installmentSchedules.amount,
      status: installmentSchedules.status,
      saleId: sales.id,
      invoiceNumber: sales.invoiceNumber,
      customerName: sales.customerNameSnap,
      customerPhone: sales.customerPhoneSnap,
      unitBrand: sales.unitBrandSnap,
      unitModel: sales.unitModelSnap,
    })
    .from(installmentSchedules)
    .innerJoin(installmentPlans, eq(installmentSchedules.installmentPlanId, installmentPlans.id))
    .innerJoin(sales, eq(installmentPlans.saleId, sales.id))
    .where(
      and(
        eq(installmentSchedules.showroomId, user.showroomId),
        eq(sales.isVoided, false),
        sql`${installmentSchedules.status} IN ('pending', 'partially_paid')`,
        sql`${installmentSchedules.dueDate} >= ${startOfTodayUTCSeconds} AND ${installmentSchedules.dueDate} < ${endOfTodayUTCSeconds}`
      )
    )
    .orderBy(asc(installmentSchedules.dueDate));

  // 6. Installments due this week (next 7 days)
  const endOfWeekUTCSeconds = startOfTodayUTCSeconds + 7 * 86400;
  const dueThisWeekList = await db
    .select({
      scheduleId: installmentSchedules.id,
      installmentNumber: installmentSchedules.installmentNumber,
      dueDate: installmentSchedules.dueDate,
      amount: installmentSchedules.amount,
      status: installmentSchedules.status,
      saleId: sales.id,
      invoiceNumber: sales.invoiceNumber,
      customerName: sales.customerNameSnap,
      customerPhone: sales.customerPhoneSnap,
      unitBrand: sales.unitBrandSnap,
      unitModel: sales.unitModelSnap,
    })
    .from(installmentSchedules)
    .innerJoin(installmentPlans, eq(installmentSchedules.installmentPlanId, installmentPlans.id))
    .innerJoin(sales, eq(installmentPlans.saleId, sales.id))
    .where(
      and(
        eq(installmentSchedules.showroomId, user.showroomId),
        eq(sales.isVoided, false),
        sql`${installmentSchedules.status} IN ('pending', 'partially_paid')`,
        sql`${installmentSchedules.dueDate} >= ${startOfTodayUTCSeconds} AND ${installmentSchedules.dueDate} < ${endOfWeekUTCSeconds}`
      )
    )
    .orderBy(asc(installmentSchedules.dueDate));

  // Count total overdue
  const [totalOverdueStat] = await db
    .select({
      count: sql<number>`COUNT(${installmentSchedules.id})`,
      totalAmount: sql<number>`COALESCE(SUM(${installmentSchedules.amount}), 0)`,
    })
    .from(installmentSchedules)
    .innerJoin(installmentPlans, eq(installmentSchedules.installmentPlanId, installmentPlans.id))
    .innerJoin(sales, eq(installmentPlans.saleId, sales.id))
    .where(
      and(
        eq(installmentSchedules.showroomId, user.showroomId),
        eq(sales.isVoided, false),
        eq(installmentSchedules.status, "overdue")
      )
    );

  return c.json({
    stock: {
      total: totalInStock,
      byModel: stockRows.map((r) => ({
        brand: r.brandName,
        model: r.modelName,
        count: Number(r.count),
      })),
    },
    salesMonth: {
      count: Number(salesMonthStat?.count || 0),
      totalAmount: Number(salesMonthStat?.totalAmount || 0),
    },
    collectedToday: {
      count: Number(collectedTodayStat?.count || 0),
      totalAmount: Number(collectedTodayStat?.totalAmount || 0),
    },
    overdue: {
      count: Number(totalOverdueStat?.count || 0),
      totalAmount: Number(totalOverdueStat?.totalAmount || 0),
      items: overdueList,
    },
    dueToday: {
      count: dueTodayList.length,
      items: dueTodayList,
    },
    dueThisWeek: {
      count: dueThisWeekList.length,
      items: dueThisWeekList,
    },
  });
});
