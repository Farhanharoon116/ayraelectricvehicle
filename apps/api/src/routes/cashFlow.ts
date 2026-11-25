import { Hono } from "hono";
import { eq, and, sql, desc, asc, lt } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { requireOwner } from "../middleware/auth";
import {
  accounts,
  accountTransactions,
  sales,
  suppliers,
  supplierTransactions,
  installmentSchedules,
  toCSV,
} from "@aev/shared";

export const cashFlowRoutes = new Hono<AppContext>();

// Require Owner for all cash flow endpoints
cashFlowRoutes.use("*", requireOwner);

// ============================================================================
// GET /api/cash-flow — Comprehensive Cash Flow & Liquidity Analysis
// Inflows vs outflows by day/week/month, category & account breakdown,
// plus outstanding receivables (installments) vs payables (suppliers).
// ============================================================================
cashFlowRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");
  const period = (c.req.query("period") as "day" | "week" | "month") || "day";
  const accountIdParam = c.req.query("accountId");
  const format = c.req.query("format");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000);

  const fromDate = fromParam ? new Date(fromParam) : thirtyDaysAgo;
  const toDate = toParam ? new Date(toParam) : now;
  const toDateInclusive = new Date(toDate.getTime() + 86400 * 1000);

  const fromSeconds = Math.floor(fromDate.getTime() / 1000);
  const toSeconds = Math.floor(toDateInclusive.getTime() / 1000);

  // 1. Fetch All Accounts for Showroom
  const allAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.showroomId, user.showroomId))
    .orderBy(asc(accounts.name));

  const filteredAccounts =
    accountIdParam && accountIdParam !== "all"
      ? allAccounts.filter((a) => a.id === accountIdParam)
      : allAccounts;

  const targetAccountIds = filteredAccounts.map((a) => a.id);

  // If filtered account doesn't exist
  if (accountIdParam && accountIdParam !== "all" && filteredAccounts.length === 0) {
    return c.json({ error: "Selected account not found" }, 404);
  }

  // Helper SQL filter for account(s)
  const accountFilter =
    targetAccountIds.length === 1
      ? eq(accountTransactions.accountId, targetAccountIds[0]!)
      : sql`${accountTransactions.accountId} IN (${sql.join(
          targetAccountIds.map((id) => sql`${id}`),
          sql`, `
        )})`;

  // 2. Opening Cash Balance across target accounts (opening balance + prior inflows - prior outflows)
  const initialOpeningBalance = filteredAccounts.reduce(
    (sum, acc) => sum + (acc.openingBalance || 0),
    0
  );

  const [priorTxSummary] = await db
    .select({
      totalIn: sql<number>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)`,
    })
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.showroomId, user.showroomId),
        accountFilter,
        sql`${accountTransactions.date} < ${fromSeconds}`
      )
    );

  const openingCash =
    initialOpeningBalance +
    Number(priorTxSummary?.totalIn || 0) -
    Number(priorTxSummary?.totalOut || 0);

  // 3. Transactions in Period
  const [periodSummary] = await db
    .select({
      totalInflow: sql<number>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)`,
      totalOutflow: sql<number>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)`,
    })
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.showroomId, user.showroomId),
        accountFilter,
        sql`${accountTransactions.date} >= ${fromSeconds}`,
        sql`${accountTransactions.date} <= ${toSeconds}`
      )
    );

  const totalInflow = Number(periodSummary?.totalInflow || 0);
  const totalOutflow = Number(periodSummary?.totalOutflow || 0);
  const netCashFlow = totalInflow - totalOutflow;
  const closingCash = openingCash + netCashFlow;

  // 4. Time Series Trend Grouping (day / week / month)
  let dateGroupExpr = sql`strftime('%Y-%m-%d', datetime(${accountTransactions.date}, 'unixepoch'))`;
  if (period === "week") {
    dateGroupExpr = sql`strftime('%Y-W%W', datetime(${accountTransactions.date}, 'unixepoch'))`;
  } else if (period === "month") {
    dateGroupExpr = sql`strftime('%Y-%m', datetime(${accountTransactions.date}, 'unixepoch'))`;
  }

  const trendRows = await db
    .select({
      timeBucket: dateGroupExpr,
      inflow: sql<number>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)`,
      outflow: sql<number>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)`,
    })
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.showroomId, user.showroomId),
        accountFilter,
        sql`${accountTransactions.date} >= ${fromSeconds}`,
        sql`${accountTransactions.date} <= ${toSeconds}`
      )
    )
    .groupBy(dateGroupExpr)
    .orderBy(asc(dateGroupExpr));

  let runningCash = openingCash;
  const trend = trendRows.map((t) => {
    const inf = Number(t.inflow || 0);
    const outf = Number(t.outflow || 0);
    const net = inf - outf;
    runningCash += net;
    return {
      period: t.timeBucket as string,
      inflow: inf,
      outflow: outf,
      net,
      runningCash,
    };
  });

  // 5. Inflows Breakdown by Category
  const inflowCategoryRows = await db
    .select({
      category: accountTransactions.category,
      amount: sql<number>`COALESCE(SUM(amount), 0)`,
    })
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.showroomId, user.showroomId),
        accountFilter,
        eq(accountTransactions.direction, "in"),
        sql`${accountTransactions.date} >= ${fromSeconds}`,
        sql`${accountTransactions.date} <= ${toSeconds}`
      )
    )
    .groupBy(accountTransactions.category)
    .orderBy(desc(sql`SUM(amount)`));

  const categoryInflows = inflowCategoryRows.map((cRow) => {
    const amt = Number(cRow.amount || 0);
    return {
      category: cRow.category,
      amount: amt,
      percentage: totalInflow > 0 ? Math.round((amt / totalInflow) * 100) : 0,
    };
  });

  // 6. Outflows Breakdown by Category
  const outflowCategoryRows = await db
    .select({
      category: accountTransactions.category,
      amount: sql<number>`COALESCE(SUM(amount), 0)`,
    })
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.showroomId, user.showroomId),
        accountFilter,
        eq(accountTransactions.direction, "out"),
        sql`${accountTransactions.date} >= ${fromSeconds}`,
        sql`${accountTransactions.date} <= ${toSeconds}`
      )
    )
    .groupBy(accountTransactions.category)
    .orderBy(desc(sql`SUM(amount)`));

  const categoryOutflows = outflowCategoryRows.map((cRow) => {
    const amt = Number(cRow.amount || 0);
    return {
      category: cRow.category,
      amount: amt,
      percentage: totalOutflow > 0 ? Math.round((amt / totalOutflow) * 100) : 0,
    };
  });

  // 7. Breakdown by Account
  const accountBreakdown = await Promise.all(
    filteredAccounts.map(async (acc) => {
      // Historical all-time summary for current balance
      const [histSummary] = await db
        .select({
          totalIn: sql<number>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)`,
          totalOut: sql<number>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)`,
        })
        .from(accountTransactions)
        .where(eq(accountTransactions.accountId, acc.id));

      const currentBalance =
        acc.openingBalance +
        Number(histSummary?.totalIn || 0) -
        Number(histSummary?.totalOut || 0);

      // Period summary for this account
      const [accPeriod] = await db
        .select({
          inflow: sql<number>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)`,
          outflow: sql<number>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)`,
        })
        .from(accountTransactions)
        .where(
          and(
            eq(accountTransactions.accountId, acc.id),
            sql`${accountTransactions.date} >= ${fromSeconds}`,
            sql`${accountTransactions.date} <= ${toSeconds}`
          )
        );

      const periodIn = Number(accPeriod?.inflow || 0);
      const periodOut = Number(accPeriod?.outflow || 0);

      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        bankName: acc.bankName,
        isActive: acc.isActive,
        periodInflow: periodIn,
        periodOutflow: periodOut,
        periodNet: periodIn - periodOut,
        currentBalance,
      };
    })
  );

  // 8. Outstanding Liquidity Position:
  // Receivables (Uncollected Installments) vs Payables (Owed to Suppliers)

  // 8a. Installments Receivable
  const installmentSales = await db
    .select({
      id: sales.id,
      totalAmount: sales.totalAmount,
      totalPaid: sql<number>`COALESCE((
        SELECT SUM(amount) FROM payments
        WHERE payments.sale_id = ${sales.id}
      ), 0)`,
    })
    .from(sales)
    .where(
      and(
        eq(sales.showroomId, user.showroomId),
        eq(sales.saleType, "installment"),
        eq(sales.isVoided, false)
      )
    );

  let totalInstallmentDue = 0;
  let activeInstallmentCount = 0;

  for (const s of installmentSales) {
    const remaining = s.totalAmount - Number(s.totalPaid || 0);
    if (remaining > 0) {
      totalInstallmentDue += remaining;
      activeInstallmentCount += 1;
    }
  }

  // 8b. Overdue Installments
  const [overdueSummary] = await db
    .select({
      overdueAmount: sql<number>`COALESCE(SUM(amount + fine_amount), 0)`,
      overdueCount: sql<number>`COUNT(*)`,
    })
    .from(installmentSchedules)
    .where(
      and(
        eq(installmentSchedules.showroomId, user.showroomId),
        sql`${installmentSchedules.status} IN ('pending', 'partially_paid', 'overdue')`,
        lt(installmentSchedules.dueDate, now)
      )
    );

  // 8c. Supplier Payables (Total Purchases - Total Payments)
  const allSuppliers = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.showroomId, user.showroomId));

  let totalSupplierPayables = 0;
  let suppliersOwedCount = 0;

  const supplierBalances = await Promise.all(
    allSuppliers.map(async (sup) => {
      const [txSum] = await db
        .select({
          purchases: sql<number>`COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END), 0)`,
          payments: sql<number>`COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0)`,
        })
        .from(supplierTransactions)
        .where(eq(supplierTransactions.supplierId, sup.id));

      const bal = Number(txSum?.purchases || 0) - Number(txSum?.payments || 0);
      if (bal > 0) {
        totalSupplierPayables += bal;
        suppliersOwedCount += 1;
      }
      return { id: sup.id, name: sup.name, balancePayable: bal };
    })
  );

  const netOutstanding = totalInstallmentDue - totalSupplierPayables;

  // 9. If CSV Export Requested
  if (format === "csv") {
    const headers = [
      "Period",
      "Inflow (PKR)",
      "Outflow (PKR)",
      "Net Cash Flow (PKR)",
      "Closing Cash Position (PKR)",
    ];
    const rows = trend.map((t) => [
      t.period,
      t.inflow,
      t.outflow,
      t.net,
      t.runningCash,
    ]);
    const csvContent = toCSV(headers, rows);
    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aev-cashflow-${fromParam || "start"}-to-${toParam || "now"}.csv"`,
      },
    });
  }

  return c.json({
    summary: {
      from: fromParam || thirtyDaysAgo.toISOString().split("T")[0]!,
      to: toParam || now.toISOString().split("T")[0]!,
      period,
      openingCash,
      totalInflow,
      totalOutflow,
      netCashFlow,
      closingCash,
    },
    trend,
    byCategory: {
      inflows: categoryInflows,
      outflows: categoryOutflows,
    },
    byAccount: accountBreakdown,
    outstanding: {
      receivables: {
        totalInstallmentDue,
        overdueAmount: Number(overdueSummary?.overdueAmount || 0),
        overdueCount: Number(overdueSummary?.overdueCount || 0),
        activeAccountsCount: activeInstallmentCount,
      },
      payables: {
        totalSupplierPayables,
        suppliersOwedCount,
        suppliers: supplierBalances.filter((s) => s.balancePayable > 0),
      },
      netOutstanding,
    },
  });
});
