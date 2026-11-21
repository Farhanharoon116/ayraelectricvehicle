import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql, desc } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { requireOwner } from "../middleware/auth";
import {
  suppliers,
  supplierTransactions,
  auditLogs,
  createSupplierSchema,
  createSupplierPaymentSchema,
} from "@aev/shared";

export const supplierRoutes = new Hono<AppContext>();

// List suppliers with computed ledger balance (totalPurchases - totalPayments)
supplierRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const supplierRows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      phone: suppliers.phone,
      address: suppliers.address,
      cnic: suppliers.cnic,
      createdAt: suppliers.createdAt,
      totalPurchases: sql<number>`COALESCE(
        (SELECT SUM(amount) FROM supplier_transactions
         WHERE supplier_transactions.supplier_id = ${suppliers.id}
         AND supplier_transactions.type = 'purchase'), 0
      )`,
      totalPayments: sql<number>`COALESCE(
        (SELECT SUM(amount) FROM supplier_transactions
         WHERE supplier_transactions.supplier_id = ${suppliers.id}
         AND supplier_transactions.type = 'payment'), 0
      )`,
    })
    .from(suppliers)
    .where(eq(suppliers.showroomId, user.showroomId))
    .orderBy(suppliers.name);

  const formatted = supplierRows.map((s) => {
    const purchases = Number(s.totalPurchases || 0);
    const payments = Number(s.totalPayments || 0);
    return {
      ...s,
      totalPurchases: purchases,
      totalPayments: payments,
      balancePayable: purchases - payments, // Dynamic balance
    };
  });

  return c.json({ suppliers: formatted });
});

// Create supplier
supplierRoutes.post("/", zValidator("json", createSupplierSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  const supplierId = crypto.randomUUID();
  const now = new Date();

  await db.batch([
    db.insert(suppliers).values({
      id: supplierId,
      showroomId: user.showroomId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address?.trim() || null,
      cnic: data.cnic?.trim() || null,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "SUPPLIER_CREATED",
      entityType: "supplier",
      entityId: supplierId,
      details: JSON.stringify({ name: data.name, phone: data.phone }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, supplierId }, 201);
});

// Get supplier ledger history
supplierRoutes.get("/:id/ledger", async (c) => {
  const user = c.get("user")!;
  const supplierId = c.req.param("id");
  const db = createDb(c.env.DB);

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.showroomId, user.showroomId)))
    .limit(1);

  if (!supplier) {
    return c.json({ error: "Supplier not found" }, 404);
  }

  const transactions = await db
    .select()
    .from(supplierTransactions)
    .where(
      and(
        eq(supplierTransactions.supplierId, supplierId),
        eq(supplierTransactions.showroomId, user.showroomId)
      )
    )
    .orderBy(desc(supplierTransactions.transactionDate));

  return c.json({ supplier, transactions });
});

// Record supplier payment (Owner only)
supplierRoutes.post("/:id/payments", requireOwner, zValidator("json", createSupplierPaymentSchema), async (c) => {
  const user = c.get("user")!;
  const supplierId = c.req.param("id");
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.showroomId, user.showroomId)))
    .limit(1);

  if (!supplier) {
    return c.json({ error: "Supplier not found" }, 404);
  }

  const txId = crypto.randomUUID();
  const now = new Date();
  const txDate = new Date(data.transactionDate);

  await db.batch([
    db.insert(supplierTransactions).values({
      id: txId,
      showroomId: user.showroomId,
      supplierId,
      type: "payment",
      amount: data.amount,
      reference: data.reference?.trim() || null,
      notes: data.notes?.trim() || null,
      transactionDate: txDate,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "SUPPLIER_PAYMENT_RECORDED",
      entityType: "supplier_transaction",
      entityId: txId,
      details: JSON.stringify({
        supplierId,
        supplierName: supplier.name,
        amount: data.amount,
        reference: data.reference,
      }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, transactionId: txId }, 201);
});
