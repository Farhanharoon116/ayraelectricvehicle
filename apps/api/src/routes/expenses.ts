import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import {
  expenses,
  expenseCategories,
  accounts,
  accountTransactions,
  users,
  auditLogs,
  createExpenseSchema,
  voidExpenseSchema,
  createExpenseCategorySchema,
} from "@aev/shared";

export const expenseRoutes = new Hono<AppContext>();

// ============================================================================
// 1. GET /api/expenses — List showroom expenses
// ============================================================================
expenseRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const categoryParam = c.req.query("category");
  const accountIdParam = c.req.query("accountId");
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  const conditions = [eq(expenses.showroomId, user.showroomId)];

  if (categoryParam) {
    conditions.push(eq(expenses.category, categoryParam));
  }
  if (accountIdParam) {
    conditions.push(eq(expenses.accountId, accountIdParam));
  }
  if (fromParam) {
    const fromSeconds = Math.floor(new Date(fromParam).getTime() / 1000);
    conditions.push(sql`${expenses.date} >= ${fromSeconds}`);
  }
  if (toParam) {
    const toSeconds = Math.floor(new Date(toParam).getTime() / 1000) + 86400;
    conditions.push(sql`${expenses.date} <= ${toSeconds}`);
  }

  const rows = await db
    .select({
      id: expenses.id,
      category: expenses.category,
      amount: expenses.amount,
      date: expenses.date,
      notes: expenses.notes,
      receiptR2Key: expenses.receiptR2Key,
      isVoided: expenses.isVoided,
      voidReason: expenses.voidReason,
      voidedAt: expenses.voidedAt,
      createdAt: expenses.createdAt,
      accountId: accounts.id,
      accountName: accounts.name,
      accountType: accounts.type,
      createdByName: users.fullName,
      createdByEmail: users.email,
    })
    .from(expenses)
    .innerJoin(accounts, eq(expenses.accountId, accounts.id))
    .innerJoin(users, eq(expenses.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));

  const totalAmount = rows.filter((r) => !r.isVoided).reduce((s, r) => s + r.amount, 0);

  return c.json({
    expenses: rows,
    summary: {
      count: rows.length,
      activeCount: rows.filter((r) => !r.isVoided).length,
      totalAmount,
    },
  });
});

// ============================================================================
// 2. POST /api/expenses — Record new showroom expense
// Atomic batch: expense row + append-only account_transactions outflow + audit
// ============================================================================
expenseRoutes.post("/", zValidator("json", createExpenseSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, data.accountId), eq(accounts.showroomId, user.showroomId)))
    .limit(1);

  if (!account) return c.json({ error: "Selected account not found" }, 404);
  if (!account.isActive) return c.json({ error: "Cannot pay expenses from an inactive account" }, 400);

  const expenseId = crypto.randomUUID();
  const txDate = new Date(data.date);
  const amount = Math.round(data.amount);
  const txId = `tx_exp_${expenseId}`;

  await db.batch([
    // 1. Expense row
    db.insert(expenses).values({
      id: expenseId,
      showroomId: user.showroomId,
      accountId: account.id,
      category: data.category.trim(),
      amount,
      date: txDate,
      notes: data.notes?.trim() ?? null,
      receiptR2Key: data.receiptR2Key?.trim() ?? null,
      isVoided: false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    }),

    // 2. Outflow ledger entry
    db.insert(accountTransactions).values({
      id: txId,
      showroomId: user.showroomId,
      accountId: account.id,
      date: txDate,
      direction: "out",
      amount,
      type: "expense",
      category: data.category.trim(),
      referenceType: "expense",
      referenceId: expenseId,
      notes: `Expense: ${data.category.trim()}${data.notes ? ` - ${data.notes.trim()}` : ""}`,
      createdBy: user.id,
      createdAt: now,
    }),

    // 3. Audit log
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "EXPENSE_RECORDED",
      entityType: "expense",
      entityId: expenseId,
      details: JSON.stringify({
        category: data.category,
        amount,
        accountName: account.name,
      }),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, expenseId }, 201);
});

// ============================================================================
// 3. POST /api/expenses/:id/void — Void an expense (Append-Only Reversal)
// ============================================================================
expenseRoutes.post("/:id/void", zValidator("json", voidExpenseSchema), async (c) => {
  const user = c.get("user")!;
  const expenseId = c.req.param("id");
  const { voidReason } = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  const [expense] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.showroomId, user.showroomId)))
    .limit(1);

  if (!expense) return c.json({ error: "Expense not found" }, 404);
  if (expense.isVoided) return c.json({ error: "Expense is already voided" }, 400);

  const reversalTxId = `tx_rev_exp_${expense.id}`;

  await db.batch([
    // 1. Mark expense voided
    db.update(expenses)
      .set({
        isVoided: true,
        voidReason: voidReason.trim(),
        voidedBy: user.id,
        voidedAt: now,
        updatedAt: now,
      })
      .where(eq(expenses.id, expense.id)),

    // 2. Append reversing entry to account_transactions
    db.insert(accountTransactions).values({
      id: reversalTxId,
      showroomId: user.showroomId,
      accountId: expense.accountId,
      date: now,
      direction: "in",
      amount: expense.amount,
      type: "adjustment",
      category: "Voided Expense Reversal",
      referenceType: "expense",
      referenceId: `${expense.id}:void_reversal`,
      reversesId: `tx_exp_${expense.id}`,
      notes: `Reversal for voided expense: ${expense.category} - Reason: ${voidReason.trim()}`,
      createdBy: user.id,
      createdAt: now,
    }),

    // 3. Audit log
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "EXPENSE_VOIDED",
      entityType: "expense",
      entityId: expense.id,
      details: JSON.stringify({
        category: expense.category,
        amount: expense.amount,
        voidReason,
      }),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true });
});

// ============================================================================
// 4. Categories CRUD
// ============================================================================
expenseRoutes.get("/categories", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const categories = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.showroomId, user.showroomId))
    .orderBy(asc(expenseCategories.name));

  return c.json({ categories });
});

expenseRoutes.post("/categories", zValidator("json", createExpenseCategorySchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  const categoryId = `cat_${crypto.randomUUID()}`;

  await db.insert(expenseCategories).values({
    id: categoryId,
    showroomId: user.showroomId,
    name: data.name.trim(),
    isDefault: false,
    createdAt: new Date(),
  });

  return c.json({ success: true, categoryId }, 201);
});

// ============================================================================
// 5. Receipt Photo Upload (R2)
// ============================================================================
expenseRoutes.post("/receipt-upload", async (c) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const file = body["receipt"] as File | undefined;

  if (!file) return c.json({ error: "Receipt image file is required" }, 400);

  const ext = file.name.split(".").pop() || "jpg";
  const r2Key = `receipts/${user.showroomId}/${crypto.randomUUID()}.${ext}`;

  await c.env.DOCUMENTS.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });

  return c.json({ receiptR2Key: r2Key });
});
