import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, asc, sql, lte } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { requireOwner } from "../middleware/auth";
import {
  accounts,
  accountTransactions,
  accountTransfers,
  auditLogs,
  createAccountSchema,
  updateAccountSchema,
  createTransferSchema,
  reconcileAccountSchema,
  toCSV,
  formatPKTDate,
} from "@aev/shared";

export const accountRoutes = new Hono<AppContext>();

// ============================================================================
// 1. GET /api/accounts — List accounts with dynamic balance computation
// Staff sees accounts for selection; Owner sees complete balances and details
// ============================================================================
accountRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);
  const isOwner = user.role === "owner";

  const accountRows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      bankName: accounts.bankName,
      accountTitle: accounts.accountTitle,
      accountNumber: accounts.accountNumber,
      openingBalance: accounts.openingBalance,
      openingDate: accounts.openingDate,
      isActive: accounts.isActive,
      createdAt: accounts.createdAt,
      totalIn: sql<number>`COALESCE((
        SELECT SUM(amount) FROM account_transactions
        WHERE account_transactions.account_id = ${accounts.id}
        AND account_transactions.direction = 'in'
      ), 0)`,
      totalOut: sql<number>`COALESCE((
        SELECT SUM(amount) FROM account_transactions
        WHERE account_transactions.account_id = ${accounts.id}
        AND account_transactions.direction = 'out'
      ), 0)`,
    })
    .from(accounts)
    .where(eq(accounts.showroomId, user.showroomId))
    .orderBy(accounts.type, accounts.name);

  const formatted = accountRows.map((acc) => {
    const totalIn = Number(acc.totalIn || 0);
    const totalOut = Number(acc.totalOut || 0);
    const balance = acc.openingBalance + totalIn - totalOut;

    // Staff only gets identification details for recording payments/expenses
    if (!isOwner) {
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        bankName: acc.bankName,
        accountTitle: acc.accountTitle,
        accountNumber: acc.accountNumber,
        isActive: acc.isActive,
      };
    }

    return {
      ...acc,
      totalIn,
      totalOut,
      balance,
    };
  });

  return c.json({ accounts: formatted });
});

// ============================================================================
// 2. POST /api/accounts — Create account (Owner Only)
// ============================================================================
accountRoutes.post("/", requireOwner, zValidator("json", createAccountSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  const accountId = crypto.randomUUID();
  const openingDate = new Date(data.openingDate);
  const openingBalance = Math.round(data.openingBalance);

  await db.batch([
    db.insert(accounts).values({
      id: accountId,
      showroomId: user.showroomId,
      name: data.name.trim(),
      type: data.type,
      bankName: data.bankName?.trim() ?? null,
      accountTitle: data.accountTitle?.trim() ?? null,
      accountNumber: data.accountNumber?.trim() ?? null,
      openingBalance,
      openingDate,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "ACCOUNT_CREATED",
      entityType: "account",
      entityId: accountId,
      details: JSON.stringify({ name: data.name, type: data.type, openingBalance }),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, accountId }, 201);
});

// ============================================================================
// 3. PUT /api/accounts/:id — Update account details (Owner Only)
// Rule 7: Block editing opening balance once txs exist. Block deactivating non-zero balance.
// ============================================================================
accountRoutes.put("/:id", requireOwner, zValidator("json", updateAccountSchema), async (c) => {
  const user = c.get("user")!;
  const accountId = c.req.param("id");
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.showroomId, user.showroomId)))
    .limit(1);

  if (!account) return c.json({ error: "Account not found" }, 404);

  // Rule 7 Check: If deactivating, confirm computed balance is strictly zero
  if (data.isActive === false && account.isActive) {
    const [txSummary] = await db
      .select({
        totalIn: sql<number>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)`,
        totalOut: sql<number>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)`,
      })
      .from(accountTransactions)
      .where(eq(accountTransactions.accountId, accountId));

    const currentBalance = account.openingBalance + Number(txSummary?.totalIn || 0) - Number(txSummary?.totalOut || 0);
    if (currentBalance !== 0) {
      return c.json(
        { error: `Cannot deactivate account with a non-zero balance (Rs ${currentBalance.toLocaleString("en-PK")}). Please transfer or reconcile funds out first.` },
        400
      );
    }
  }

  await db.batch([
    db.update(accounts)
      .set({
        name: data.name?.trim() ?? account.name,
        bankName: data.bankName !== undefined ? data.bankName?.trim() || null : account.bankName,
        accountTitle: data.accountTitle !== undefined ? data.accountTitle?.trim() || null : account.accountTitle,
        accountNumber: data.accountNumber !== undefined ? data.accountNumber?.trim() || null : account.accountNumber,
        isActive: data.isActive !== undefined ? data.isActive : account.isActive,
        updatedAt: now,
      })
      .where(eq(accounts.id, accountId)),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "ACCOUNT_UPDATED",
      entityType: "account",
      entityId: accountId,
      details: JSON.stringify(data),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true });
});

// ============================================================================
// 4. GET /api/accounts/:id/statement — Detailed account ledger statement
// Owner only: provides date-filtered chronological running balance + CSV export
// ============================================================================
accountRoutes.get("/:id/statement", requireOwner, async (c) => {
  const user = c.get("user")!;
  const accountId = c.req.param("id");
  const db = createDb(c.env.DB);

  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");
  const format = c.req.query("format");

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.showroomId, user.showroomId)))
    .limit(1);

  if (!account) return c.json({ error: "Account not found" }, 404);

  const fromDate = fromParam ? new Date(fromParam) : new Date(account.openingDate);
  const toDate = toParam ? new Date(toParam) : new Date();
  const toDateInclusive = new Date(toDate.getTime() + 86400 * 1000);

  // Compute opening balance before 'fromDate'
  const [priorTxSummary] = await db
    .select({
      totalIn: sql<number>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)`,
    })
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.accountId, accountId),
        sql`${accountTransactions.date} < ${Math.floor(fromDate.getTime() / 1000)}`
      )
    );

  const initialPeriodBalance = account.openingBalance + Number(priorTxSummary?.totalIn || 0) - Number(priorTxSummary?.totalOut || 0);

  // Fetch transactions in period
  const txRows = await db
    .select()
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.accountId, accountId),
        sql`${accountTransactions.date} >= ${Math.floor(fromDate.getTime() / 1000)}`,
        sql`${accountTransactions.date} <= ${Math.floor(toDateInclusive.getTime() / 1000)}`
      )
    )
    .orderBy(asc(accountTransactions.date), asc(accountTransactions.createdAt));

  let running = initialPeriodBalance;
  const entries = txRows.map((tx) => {
    const isIn = tx.direction === "in";
    running += isIn ? tx.amount : -tx.amount;

    return {
      id: tx.id,
      date: tx.date,
      direction: tx.direction,
      amount: tx.amount,
      type: tx.type,
      category: tx.category ?? "General",
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      notes: tx.notes ?? "",
      reversesId: tx.reversesId,
      runningBalance: running,
    };
  });

  const totalIn = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
  const closingBalance = running;

  if (format === "csv") {
    const headers = [
      "Date",
      "Direction",
      "Type",
      "Category",
      "Reference Type",
      "Reference ID",
      "Inflow / Credit (PKR)",
      "Outflow / Debit (PKR)",
      "Running Balance (PKR)",
      "Notes",
    ];

    const rows = entries.map((e) => [
      formatPKTDate(e.date),
      e.direction.toUpperCase(),
      e.type,
      e.category,
      e.referenceType ?? "",
      e.referenceId ?? "",
      e.direction === "in" ? e.amount : "",
      e.direction === "out" ? e.amount : "",
      e.runningBalance,
      e.notes,
    ]);

    const csvData = toCSV(headers, rows);
    return new Response(csvData, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="statement_${account.name.replace(/\s+/g, "_")}.csv"`,
      },
    });
  }

  return c.json({
    account,
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      initialPeriodBalance,
      totalIn,
      totalOut,
      closingBalance,
    },
    entries,
  });
});

// ============================================================================
// 5. POST /api/accounts/transfer — Inter-account transfer (Owner Only)
// Rule 8: amount > 0, fromAccountId !== toAccountId, both accounts active.
// In one batch: transfer record + from outflow + to inflow + audit log.
// ============================================================================
accountRoutes.post("/transfer", requireOwner, zValidator("json", createTransferSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  if (data.fromAccountId === data.toAccountId) {
    return c.json({ error: "Source and destination accounts must be different" }, 400);
  }

  const [fromAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, data.fromAccountId), eq(accounts.showroomId, user.showroomId)))
    .limit(1);

  const [toAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, data.toAccountId), eq(accounts.showroomId, user.showroomId)))
    .limit(1);

  if (!fromAccount || !toAccount) {
    return c.json({ error: "One or both selected accounts do not exist" }, 404);
  }

  if (!fromAccount.isActive || !toAccount.isActive) {
    return c.json({ error: "Transfers can only be performed between active accounts" }, 400);
  }

  const transferId = crypto.randomUUID();
  const txDate = new Date(data.date);
  const amount = Math.round(data.amount);

  const fromTxId = `tx_trf_out_${transferId}`;
  const toTxId = `tx_trf_in_${transferId}`;

  await db.batch([
    // 1. Transfer record
    db.insert(accountTransfers).values({
      id: transferId,
      showroomId: user.showroomId,
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amount,
      date: txDate,
      notes: data.notes?.trim() ?? null,
      fromTransactionId: fromTxId,
      toTransactionId: toTxId,
      createdBy: user.id,
      createdAt: now,
    }),

    // 2. Outflow from source account
    db.insert(accountTransactions).values({
      id: fromTxId,
      showroomId: user.showroomId,
      accountId: fromAccount.id,
      date: txDate,
      direction: "out",
      amount,
      type: "transfer",
      category: "Account Transfer",
      referenceType: "transfer",
      referenceId: transferId,
      notes: `Transfer to ${toAccount.name}${data.notes ? ` - ${data.notes}` : ""}`,
      createdBy: user.id,
      createdAt: now,
    }),

    // 3. Inflow into destination account
    db.insert(accountTransactions).values({
      id: toTxId,
      showroomId: user.showroomId,
      accountId: toAccount.id,
      date: txDate,
      direction: "in",
      amount,
      type: "transfer",
      category: "Account Transfer",
      referenceType: "transfer",
      referenceId: transferId,
      notes: `Transfer from ${fromAccount.name}${data.notes ? ` - ${data.notes}` : ""}`,
      createdBy: user.id,
      createdAt: now,
    }),

    // 4. Audit log
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "ACCOUNT_TRANSFER",
      entityType: "account_transfer",
      entityId: transferId,
      details: JSON.stringify({
        from: fromAccount.name,
        to: toAccount.name,
        amount,
        notes: data.notes,
      }),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, transferId });
});

// ============================================================================
// 6. POST /api/accounts/:id/reconcile — Account Reconciliation (Owner Only)
// Rule 8: Reconciliation uses the balance as of the counted date.
// Generates append-only adjustment ledger entry with required reason.
// ============================================================================
accountRoutes.post("/:id/reconcile", requireOwner, zValidator("json", reconcileAccountSchema), async (c) => {
  const user = c.get("user")!;
  const accountId = c.req.param("id");
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.showroomId, user.showroomId)))
    .limit(1);

  if (!account) return c.json({ error: "Account not found" }, 404);
  if (!account.isActive) return c.json({ error: "Cannot reconcile an inactive account" }, 400);

  const countedDate = new Date(data.countedDate);
  const countedDateSeconds = Math.floor(countedDate.getTime() / 1000) + 86400; // end of counted date

  // Rule 8: Balance as of counted date
  const [txSummary] = await db
    .select({
      totalIn: sql<number>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)`,
    })
    .from(accountTransactions)
    .where(
      and(
        eq(accountTransactions.accountId, accountId),
        lte(accountTransactions.date, new Date(countedDateSeconds * 1000))
      )
    );

  const computedBalanceAsOfDate = account.openingBalance + Number(txSummary?.totalIn || 0) - Number(txSummary?.totalOut || 0);
  const countedBalance = Math.round(data.countedBalance);
  const difference = countedBalance - computedBalanceAsOfDate;

  if (difference === 0) {
    return c.json({
      success: true,
      message: "Counted balance matches system balance. No adjustment needed.",
      difference: 0,
      balance: countedBalance,
    });
  }

  const direction = difference > 0 ? "in" : "out";
  const adjustmentAmount = Math.abs(difference);
  const txId = crypto.randomUUID();

  await db.batch([
    db.insert(accountTransactions).values({
      id: `tx_adj_${txId}`,
      showroomId: user.showroomId,
      accountId: account.id,
      date: countedDate,
      direction,
      amount: adjustmentAmount,
      type: "adjustment",
      category: "Reconciliation Adjustment",
      referenceType: "reconciliation",
      referenceId: txId,
      notes: `Reconciliation on ${formatPKTDate(countedDate)}: System was ${computedBalanceAsOfDate.toLocaleString(
        "en-PK"
      )}, Counted was ${countedBalance.toLocaleString("en-PK")}. Reason: ${data.reason.trim()}`,
      createdBy: user.id,
      createdAt: now,
    }),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "ACCOUNT_RECONCILED",
      entityType: "account",
      entityId: account.id,
      details: JSON.stringify({
        accountName: account.name,
        countedBalance,
        computedBalanceAsOfDate,
        difference,
        reason: data.reason,
      }),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({
    success: true,
    difference,
    adjustmentAmount,
    direction,
    newBalance: countedBalance,
  });
});
