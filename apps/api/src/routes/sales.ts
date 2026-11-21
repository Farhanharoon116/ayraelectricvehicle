import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, sql } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import {
  sales,
  units,
  models,
  brands,
  customers,
  counters,
  payments,
  showrooms,
  auditLogs,
  createSaleSchema,
  amountToWords,
} from "@aev/shared";

export const salesRoutes = new Hono<AppContext>();

// List all sales with dynamic balance calculation
salesRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const saleRows = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      saleType: sales.saleType,
      saleDate: sales.saleDate,
      basePrice: sales.basePrice,
      discount: sales.discount,
      totalAmount: sales.totalAmount,
      isVoided: sales.isVoided,
      voidReason: sales.voidReason,
      customerName: sales.customerNameSnap,
      customerPhone: sales.customerPhoneSnap,
      unitBrand: sales.unitBrandSnap,
      unitModel: sales.unitModelSnap,
      unitColor: sales.unitColorSnap,
      unitChassis: sales.unitChassisSnap,
      totalPaid: sql<number>`COALESCE((
        SELECT SUM(amount) FROM payments
        WHERE payments.sale_id = ${sales.id}
      ), 0)`,
    })
    .from(sales)
    .where(eq(sales.showroomId, user.showroomId))
    .orderBy(desc(sales.saleDate));

  const formatted = saleRows.map((s) => {
    const paid = Number(s.totalPaid || 0);
    return {
      ...s,
      totalPaid: paid,
      remainingBalance: Math.max(0, s.totalAmount - paid), // Dynamic balance
    };
  });

  return c.json({ sales: formatted });
});

// Get single sale details
salesRoutes.get("/:id", async (c) => {
  const user = c.get("user")!;
  const saleId = c.req.param("id");
  const db = createDb(c.env.DB);

  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.showroomId, user.showroomId)))
    .limit(1);

  if (!sale) {
    return c.json({ error: "Sale not found" }, 404);
  }

  // Get payments
  const salePayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.saleId, saleId), eq(payments.showroomId, user.showroomId)))
    .orderBy(desc(payments.paymentDate));

  const totalPaid = salePayments.reduce((acc, p) => acc + p.amount, 0);

  return c.json({
    sale,
    payments: salePayments,
    totalPaid,
    remainingBalance: Math.max(0, sale.totalAmount - totalPaid),
  });
});

// Get full printable invoice data
salesRoutes.get("/:id/invoice", async (c) => {
  const user = c.get("user")!;
  const saleId = c.req.param("id");
  const db = createDb(c.env.DB);

  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.showroomId, user.showroomId)))
    .limit(1);

  if (!sale) {
    return c.json({ error: "Sale not found" }, 404);
  }

  const [showroom] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, user.showroomId))
    .limit(1);

  const salePayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.saleId, saleId), eq(payments.showroomId, user.showroomId)))
    .orderBy(payments.paymentDate);

  const totalPaid = salePayments.reduce((acc, p) => acc + p.amount, 0);
  const remainingBalance = Math.max(0, sale.totalAmount - totalPaid);

  return c.json({
    invoice: {
      sale,
      showroom,
      payments: salePayments,
      totalPaid,
      remainingBalance,
      totalInWords: amountToWords(sale.totalAmount),
    },
  });
});

// Create Full-Payment Sale (Atomic batch operation)
salesRoutes.post("/", zValidator("json", createSaleSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  // 1. Fetch Showroom Settings for Prefix
  const [showroom] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, user.showroomId))
    .limit(1);

  if (!showroom) return c.json({ error: "Showroom not found" }, 400);

  // 2. Fetch Customer for Snapshot
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, data.customerId), eq(customers.showroomId, user.showroomId)))
    .limit(1);

  if (!customer) return c.json({ error: "Customer not found" }, 400);

  // 3. Fetch Unit with Model and Brand for Snapshot
  const [unitRecord] = await db
    .select({
      id: units.id,
      chassisNumber: units.chassisNumber,
      motorNumber: units.motorNumber,
      batterySerialNumbers: units.batterySerialNumbers,
      color: units.color,
      status: units.status,
      modelName: models.name,
      variant: models.variant,
      brandName: brands.name,
    })
    .from(units)
    .innerJoin(models, eq(units.modelId, models.id))
    .innerJoin(brands, eq(models.brandId, brands.id))
    .where(and(eq(units.id, data.unitId), eq(units.showroomId, user.showroomId)))
    .limit(1);

  if (!unitRecord) return c.json({ error: "Unit not found" }, 400);
  if (unitRecord.status !== "in_stock") {
    return c.json({ error: `Unit is already ${unitRecord.status}` }, 400);
  }

  const currentYear = new Date().getFullYear();
  const now = new Date();
  const saleDate = new Date(data.saleDate);

  // 4. Sequential Invoice Number from Counter Table
  const counterId = `cnt_inv_${currentYear}`;
  const [counterRow] = await db
    .select()
    .from(counters)
    .where(
      and(
        eq(counters.showroomId, user.showroomId),
        eq(counters.type, "invoice"),
        eq(counters.year, currentYear)
      )
    )
    .limit(1);

  const nextSeq = (counterRow?.lastSequence || 0) + 1;
  const invoiceNumber = `${showroom.invoicePrefix}-${currentYear}-${String(nextSeq).padStart(4, "0")}`;

  // Calculate integer total
  const basePrice = Math.round(data.basePrice);
  const discount = Math.round(data.discount || 0);
  const totalAmount = Math.max(0, basePrice - discount);

  const saleId = crypto.randomUUID();
  const batchStatements: any[] = [];

  // Update or insert invoice counter in the same batch
  if (counterRow) {
    batchStatements.push(
      db
        .update(counters)
        .set({ lastSequence: nextSeq, updatedAt: now })
        .where(eq(counters.id, counterRow.id))
    );
  } else {
    batchStatements.push(
      db.insert(counters).values({
        id: counterId,
        showroomId: user.showroomId,
        type: "invoice",
        year: currentYear,
        lastSequence: nextSeq,
        updatedAt: now,
      })
    );
  }

  // Insert Sale with full immutable snapshots
  batchStatements.push(
    db.insert(sales).values({
      id: saleId,
      showroomId: user.showroomId,
      invoiceNumber,
      customerId: customer.id,
      unitId: unitRecord.id,
      saleType: data.saleType,
      saleDate,
      basePrice,
      discount,
      markupAmount: 0,
      totalAmount,
      downPaymentAmount: 0,

      // Customer Snapshot
      customerNameSnap: customer.name,
      customerCnicSnap: customer.cnic,
      customerPhoneSnap: customer.phone,
      customerAddressSnap: customer.address,

      // Unit Snapshot
      unitBrandSnap: unitRecord.brandName,
      unitModelSnap: unitRecord.modelName,
      unitVariantSnap: unitRecord.variant || null,
      unitColorSnap: unitRecord.color,
      unitChassisSnap: unitRecord.chassisNumber,
      unitMotorSnap: unitRecord.motorNumber,
      unitBatterySnap: unitRecord.batterySerialNumbers,

      isVoided: false,
      notes: data.notes?.trim() || null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
  );

  // Mark Unit as Sold
  batchStatements.push(
    db
      .update(units)
      .set({ status: "sold", soldAt: saleDate, updatedAt: now })
      .where(and(eq(units.id, unitRecord.id), eq(units.showroomId, user.showroomId)))
  );

  // Record initial payment if provided (Full Payment or down payment)
  let receiptNumber: string | undefined;
  if (data.initialPaymentAmount && data.initialPaymentAmount > 0) {
    const receiptCounterId = `cnt_rec_${currentYear}`;
    const [receiptCounterRow] = await db
      .select()
      .from(counters)
      .where(
        and(
          eq(counters.showroomId, user.showroomId),
          eq(counters.type, "receipt"),
          eq(counters.year, currentYear)
        )
      )
      .limit(1);

    const nextReceiptSeq = (receiptCounterRow?.lastSequence || 0) + 1;
    receiptNumber = `${showroom.receiptPrefix}-${currentYear}-${String(nextReceiptSeq).padStart(4, "0")}`;

    if (receiptCounterRow) {
      batchStatements.push(
        db
          .update(counters)
          .set({ lastSequence: nextReceiptSeq, updatedAt: now })
          .where(eq(counters.id, receiptCounterRow.id))
      );
    } else {
      batchStatements.push(
        db.insert(counters).values({
          id: receiptCounterId,
          showroomId: user.showroomId,
          type: "receipt",
          year: currentYear,
          lastSequence: nextReceiptSeq,
          updatedAt: now,
        })
      );
    }

    const paymentId = crypto.randomUUID();
    batchStatements.push(
      db.insert(payments).values({
        id: paymentId,
        showroomId: user.showroomId,
        saleId,
        receiptNumber,
        paymentDate: saleDate,
        amount: Math.round(data.initialPaymentAmount),
        paymentMethod: data.paymentMethod || "cash",
        reference: data.paymentReference?.trim() || null,
        notes: "Full payment on sale",
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  // Audit Log Entry
  batchStatements.push(
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "SALE_CREATED",
      entityType: "sale",
      entityId: saleId,
      details: JSON.stringify({
        invoiceNumber,
        customerId: customer.id,
        customerName: customer.name,
        unitChassis: unitRecord.chassisNumber,
        totalAmount,
        initialPaid: data.initialPaymentAmount || 0,
      }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    })
  );

  // Execute entire batch transaction atomically
  await db.batch(batchStatements as any);

  return c.json(
    {
      success: true,
      saleId,
      invoiceNumber,
      receiptNumber,
    },
    201
  );
});
