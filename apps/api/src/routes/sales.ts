import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, asc, sql } from "drizzle-orm";
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
  accountTransactions,
  showrooms,
  auditLogs,
  installmentPlans,
  installmentSchedules,
  createSaleSchema,
  voidSaleSchema,
  amountToWords,
  calculateInstallmentPlan,
} from "@aev/shared";

export const salesRoutes = new Hono<AppContext>();

// ============================================================================
// GET /api/sales — List all sales with dynamic balance calculation
// ============================================================================
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
      remainingBalance: Math.max(0, s.totalAmount - paid),
    };
  });

  return c.json({ sales: formatted });
});

// ============================================================================
// GET /api/sales/:id — Single sale enriched with installment plan & schedules
// ============================================================================
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

  const salePayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.saleId, saleId), eq(payments.showroomId, user.showroomId)))
    .orderBy(desc(payments.paymentDate));

  const totalPaid = salePayments.reduce((acc, p) => acc + p.amount, 0);

  // Fetch installment plan and schedules if applicable
  let installmentPlan: (typeof installmentPlans.$inferSelect) | null = null;
  let schedules: (typeof installmentSchedules.$inferSelect)[] = [];

  if (sale.saleType === "installment") {
    const [plan] = await db
      .select()
      .from(installmentPlans)
      .where(eq(installmentPlans.saleId, saleId))
      .limit(1);

    if (plan) {
      installmentPlan = plan;
      schedules = await db
        .select()
        .from(installmentSchedules)
        .where(eq(installmentSchedules.installmentPlanId, plan.id))
        .orderBy(asc(installmentSchedules.installmentNumber));
    }
  }

  return c.json({
    sale,
    payments: salePayments,
    totalPaid,
    remainingBalance: Math.max(0, sale.totalAmount - totalPaid),
    installmentPlan: installmentPlan ?? null,
    schedules,
  });
});

// ============================================================================
// GET /api/sales/:id/invoice — Printable invoice data
// ============================================================================
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

// ============================================================================
// GET /api/sales/:id/agreement — Installment agreement data
// ============================================================================
salesRoutes.get("/:id/agreement", async (c) => {
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

  if (sale.saleType !== "installment") {
    return c.json({ error: "This sale is not an installment sale" }, 400);
  }

  const [showroom] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, user.showroomId))
    .limit(1);

  const [plan] = await db
    .select()
    .from(installmentPlans)
    .where(eq(installmentPlans.saleId, saleId))
    .limit(1);

  let schedules: (typeof installmentSchedules.$inferSelect)[] = [];
  if (plan) {
    schedules = await db
      .select()
      .from(installmentSchedules)
      .where(eq(installmentSchedules.installmentPlanId, plan.id))
      .orderBy(asc(installmentSchedules.installmentNumber));
  }

  const salePayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.saleId, saleId), eq(payments.showroomId, user.showroomId)))
    .orderBy(payments.paymentDate);

  const totalPaid = salePayments.reduce((acc, p) => acc + p.amount, 0);

  return c.json({
    agreement: {
      sale,
      showroom,
      installmentPlan: plan ?? null,
      schedules,
      payments: salePayments,
      totalPaid,
      remainingBalance: Math.max(0, sale.totalAmount - totalPaid),
      totalInWords: amountToWords(sale.totalAmount),
    },
  });
});

// ============================================================================
// POST /api/sales — Create a sale (full_payment or installment) with split payments
// ============================================================================
salesRoutes.post("/", zValidator("json", createSaleSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  // 1. Fetch Showroom Settings
  const [showroom] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, user.showroomId))
    .limit(1);

  if (!showroom) return c.json({ error: "Showroom not found" }, 400);

  // 2. Fetch Customer for snapshot
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, data.customerId), eq(customers.showroomId, user.showroomId)))
    .limit(1);

  if (!customer) return c.json({ error: "Customer not found" }, 400);

  // 3. Fetch Unit with Model and Brand for snapshot
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

  // 4. Invoice counter
  const [invoiceCounterRow] = await db
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

  const nextInvoiceSeq = (invoiceCounterRow?.lastSequence ?? 0) + 1;
  const invoiceNumber = `${showroom.invoicePrefix}-${currentYear}-${String(nextInvoiceSeq).padStart(4, "0")}`;

  const basePrice = Math.round(data.basePrice);
  const discount = Math.round(data.discount ?? 0);
  const saleId = crypto.randomUUID();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batchStatements: any[] = [];

  // Invoice counter update/insert
  const invoiceCounterId = `cnt_inv_${currentYear}`;
  if (invoiceCounterRow) {
    batchStatements.push(
      db.update(counters).set({ lastSequence: nextInvoiceSeq, updatedAt: now }).where(eq(counters.id, invoiceCounterRow.id))
    );
  } else {
    batchStatements.push(
      db.insert(counters).values({
        id: invoiceCounterId,
        showroomId: user.showroomId,
        type: "invoice",
        year: currentYear,
        lastSequence: nextInvoiceSeq,
        updatedAt: now,
      })
    );
  }

  if (data.saleType === "full_payment") {
    // -------------------------------------------------------------------------
    // FULL PAYMENT path
    // -------------------------------------------------------------------------
    const netPrice = Math.max(0, basePrice - discount);

    batchStatements.push(
      db.insert(sales).values({
        id: saleId,
        showroomId: user.showroomId,
        invoiceNumber,
        customerId: customer.id,
        unitId: unitRecord.id,
        saleType: "full_payment",
        saleDate,
        basePrice,
        discount,
        markupAmount: 0,
        totalAmount: netPrice,
        downPaymentAmount: 0,

        customerNameSnap: customer.name,
        customerCnicSnap: customer.cnic,
        customerPhoneSnap: customer.phone,
        customerAddressSnap: customer.address,

        unitBrandSnap: unitRecord.brandName,
        unitModelSnap: unitRecord.modelName,
        unitVariantSnap: unitRecord.variant ?? null,
        unitColorSnap: unitRecord.color,
        unitChassisSnap: unitRecord.chassisNumber,
        unitMotorSnap: unitRecord.motorNumber,
        unitBatterySnap: unitRecord.batterySerialNumbers,

        isVoided: false,
        notes: data.notes?.trim() ?? null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
    );

    batchStatements.push(
      db.update(units).set({ status: "sold", soldAt: saleDate, updatedAt: now })
        .where(and(eq(units.id, unitRecord.id), eq(units.showroomId, user.showroomId)))
    );

    // Split payments — each entry gets its own receipt
    const receiptNumbers: string[] = [];

    if (data.payments.length > 0) {
      // Fetch current receipt counter once
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

      let currentReceiptSeq = receiptCounterRow?.lastSequence ?? 0;
      const receiptCounterId = `cnt_rec_${currentYear}`;
      const totalReceiptsToAdd = data.payments.length;
      const finalReceiptSeq = currentReceiptSeq + totalReceiptsToAdd;

      // Update receipt counter once for all N payments
      if (receiptCounterRow) {
        batchStatements.push(
          db.update(counters).set({ lastSequence: finalReceiptSeq, updatedAt: now })
            .where(eq(counters.id, receiptCounterRow.id))
        );
      } else {
        batchStatements.push(
          db.insert(counters).values({
            id: receiptCounterId,
            showroomId: user.showroomId,
            type: "receipt",
            year: currentYear,
            lastSequence: finalReceiptSeq,
            updatedAt: now,
          })
        );
      }

      for (const payEntry of data.payments) {
        currentReceiptSeq += 1;
        const receiptNum = `${showroom.receiptPrefix}-${currentYear}-${String(currentReceiptSeq).padStart(4, "0")}`;
        receiptNumbers.push(receiptNum);
        const paymentId = crypto.randomUUID();

        batchStatements.push(
          db.insert(payments).values({
            id: paymentId,
            showroomId: user.showroomId,
            saleId,
            receiptNumber: receiptNum,
            accountId: payEntry.accountId,
            paymentDate: saleDate,
            amount: Math.round(payEntry.amount),
            paymentMethod: payEntry.paymentMethod,
            reference: payEntry.reference?.trim() ?? null,
            notes: payEntry.notes?.trim() ?? "Full payment on sale",
            createdBy: user.id,
            createdAt: now,
            updatedAt: now,
          })
        );

        batchStatements.push(
          db.insert(accountTransactions).values({
            id: `tx_pay_${paymentId}`,
            showroomId: user.showroomId,
            accountId: payEntry.accountId,
            date: saleDate,
            direction: "in",
            amount: Math.round(payEntry.amount),
            type: "customer_payment",
            category: "Full Payment",
            referenceType: "payment",
            referenceId: paymentId,
            notes: `Payment receipt ${receiptNum} on invoice ${invoiceNumber}`,
            createdBy: user.id,
            createdAt: now,
          })
        );
      }
    }

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
          saleType: "full_payment",
          customerId: customer.id,
          customerName: customer.name,
          unitChassis: unitRecord.chassisNumber,
          totalAmount: netPrice,
          paymentCount: data.payments.length,
        }),
        ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
        userAgent: c.req.header("user-agent"),
      })
    );

    await db.batch(batchStatements as unknown as Parameters<typeof db.batch>[0]);

    return c.json({ success: true, saleId, invoiceNumber, receiptNumbers }, 201);
  } else {
    // -------------------------------------------------------------------------
    // INSTALLMENT path
    // -------------------------------------------------------------------------
    const plan = data.installmentPlan;
    if (!plan) {
      return c.json({ error: "installmentPlan is required for installment sales" }, 400);
    }

    // Validate minimum down payment
    const netPrice = Math.max(0, basePrice - discount);
    const minDownPayment =
      showroom.minDownPaymentType === "percentage"
        ? Math.round((netPrice * showroom.minDownPaymentValue) / 100)
        : showroom.minDownPaymentValue;

    if (plan.downPaymentAmount < minDownPayment) {
      return c.json(
        {
          error: `Down payment must be at least ${minDownPayment} PKR (${showroom.minDownPaymentType === "percentage" ? showroom.minDownPaymentValue + "%" : "flat"})`,
        },
        400
      );
    }

    // Calculate installment plan
    const calc = calculateInstallmentPlan({
      basePrice,
      discount,
      downPaymentAmount: plan.downPaymentAmount,
      durationMonths: plan.durationMonths,
      markupType: plan.markupType,
      markupValue: plan.markupValue,
      startDate: plan.startDate,
    });

    const installmentPlanId = crypto.randomUUID();

    // Insert sale
    batchStatements.push(
      db.insert(sales).values({
        id: saleId,
        showroomId: user.showroomId,
        invoiceNumber,
        customerId: customer.id,
        unitId: unitRecord.id,
        saleType: "installment",
        saleDate,
        basePrice,
        discount,
        markupAmount: calc.markupAmount,
        totalAmount: calc.totalPayable,
        downPaymentAmount: Math.round(plan.downPaymentAmount),

        customerNameSnap: customer.name,
        customerCnicSnap: customer.cnic,
        customerPhoneSnap: customer.phone,
        customerAddressSnap: customer.address,

        unitBrandSnap: unitRecord.brandName,
        unitModelSnap: unitRecord.modelName,
        unitVariantSnap: unitRecord.variant ?? null,
        unitColorSnap: unitRecord.color,
        unitChassisSnap: unitRecord.chassisNumber,
        unitMotorSnap: unitRecord.motorNumber,
        unitBatterySnap: unitRecord.batterySerialNumbers,

        // Guarantor
        guarantorName: plan.guarantor?.name ?? null,
        guarantorCnic: plan.guarantor?.cnic ?? null,
        guarantorPhone: plan.guarantor?.phone ?? null,
        guarantorAddress: plan.guarantor?.address ?? null,

        isVoided: false,
        notes: data.notes?.trim() ?? null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
    );

    // Mark unit sold
    batchStatements.push(
      db.update(units).set({ status: "sold", soldAt: saleDate, updatedAt: now })
        .where(and(eq(units.id, unitRecord.id), eq(units.showroomId, user.showroomId)))
    );

    // Insert installment plan
    const startDateObj = new Date(plan.startDate);
    const endDateObj = new Date(plan.startDate);
    endDateObj.setMonth(endDateObj.getMonth() + plan.durationMonths);

    batchStatements.push(
      db.insert(installmentPlans).values({
        id: installmentPlanId,
        showroomId: user.showroomId,
        saleId,
        durationMonths: plan.durationMonths,
        monthlyInstallmentAmount: calc.monthlyInstallmentAmount,
        markupType: plan.markupType,
        markupRate: plan.markupValue,
        markupAmount: calc.markupAmount,
        startDate: startDateObj,
        endDate: endDateObj,
        createdAt: now,
        updatedAt: now,
      })
    );

    // Insert schedule rows
    for (const sched of calc.schedules) {
      batchStatements.push(
        db.insert(installmentSchedules).values({
          id: crypto.randomUUID(),
          showroomId: user.showroomId,
          installmentPlanId,
          installmentNumber: sched.installmentNumber,
          dueDate: new Date(sched.dueDate),
          amount: sched.amount,
          fineAmount: 0,
          fineWaived: false,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
      );
    }

    // Down payment split payments
    const receiptNumbers: string[] = [];

    if (plan.downPaymentAmount > 0 && data.payments.length > 0) {
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

      let currentReceiptSeq = receiptCounterRow?.lastSequence ?? 0;
      const receiptCounterId = `cnt_rec_${currentYear}`;
      const finalReceiptSeq = currentReceiptSeq + data.payments.length;

      if (receiptCounterRow) {
        batchStatements.push(
          db.update(counters).set({ lastSequence: finalReceiptSeq, updatedAt: now })
            .where(eq(counters.id, receiptCounterRow.id))
        );
      } else {
        batchStatements.push(
          db.insert(counters).values({
            id: receiptCounterId,
            showroomId: user.showroomId,
            type: "receipt",
            year: currentYear,
            lastSequence: finalReceiptSeq,
            updatedAt: now,
          })
        );
      }

      for (const payEntry of data.payments) {
        currentReceiptSeq += 1;
        const receiptNum = `${showroom.receiptPrefix}-${currentYear}-${String(currentReceiptSeq).padStart(4, "0")}`;
        receiptNumbers.push(receiptNum);
        const paymentId = crypto.randomUUID();

        batchStatements.push(
          db.insert(payments).values({
            id: paymentId,
            showroomId: user.showroomId,
            saleId,
            receiptNumber: receiptNum,
            accountId: payEntry.accountId,
            paymentDate: saleDate,
            amount: Math.round(payEntry.amount),
            paymentMethod: payEntry.paymentMethod,
            reference: payEntry.reference?.trim() ?? null,
            notes: payEntry.notes?.trim() ?? "Down payment",
            createdBy: user.id,
            createdAt: now,
            updatedAt: now,
          })
        );

        batchStatements.push(
          db.insert(accountTransactions).values({
            id: `tx_pay_${paymentId}`,
            showroomId: user.showroomId,
            accountId: payEntry.accountId,
            date: saleDate,
            direction: "in",
            amount: Math.round(payEntry.amount),
            type: "customer_payment",
            category: "Down Payment",
            referenceType: "payment",
            referenceId: paymentId,
            notes: `Down payment receipt ${receiptNum} on invoice ${invoiceNumber}`,
            createdBy: user.id,
            createdAt: now,
          })
        );
      }
    }

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
          saleType: "installment",
          customerId: customer.id,
          customerName: customer.name,
          unitChassis: unitRecord.chassisNumber,
          totalAmount: calc.totalPayable,
          downPayment: plan.downPaymentAmount,
          durationMonths: plan.durationMonths,
          markupAmount: calc.markupAmount,
        }),
        ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
        userAgent: c.req.header("user-agent"),
      })
    );

    await db.batch(batchStatements as unknown as Parameters<typeof db.batch>[0]);

    return c.json(
      {
        success: true,
        saleId,
        invoiceNumber,
        receiptNumbers,
        installmentPlanId,
        totalPayable: calc.totalPayable,
        monthlyInstallmentAmount: calc.monthlyInstallmentAmount,
      },
      201
    );
  }
});

// ============================================================================
// POST /api/sales/:id/void — Void a sale (owner only)
// ============================================================================
salesRoutes.post("/:id/void", zValidator("json", voidSaleSchema), async (c) => {
  const user = c.get("user")!;

  if (user.role !== "owner") {
    return c.json({ error: "Only owners can void sales" }, 403);
  }

  const saleId = c.req.param("id");
  const { voidReason } = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.showroomId, user.showroomId)))
    .limit(1);

  if (!sale) return c.json({ error: "Sale not found" }, 404);
  if (sale.isVoided) return c.json({ error: "Sale is already voided" }, 400);

  // Fetch payments to create reversing ledger entries
  const salePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.saleId, saleId));

  const voidStatements: any[] = [
    db.update(sales).set({ isVoided: true, voidReason, voidedBy: user.id, voidedAt: now, updatedAt: now })
      .where(eq(sales.id, saleId)),
    db.update(units).set({ status: "in_stock", soldAt: null, updatedAt: now })
      .where(eq(units.id, sale.unitId)),
  ];

  for (const p of salePayments) {
    if (p.accountId) {
      voidStatements.push(
        db.insert(accountTransactions).values({
          id: `tx_rev_pay_${p.id}`,
          showroomId: user.showroomId,
          accountId: p.accountId,
          date: now,
          direction: "out",
          amount: p.amount,
          type: "adjustment",
          category: "Voided Sale Reversal",
          referenceType: "payment",
          referenceId: `${p.id}:void_reversal`,
          reversesId: `tx_pay_${p.id}`,
          notes: `Reversal for voided invoice ${sale.invoiceNumber} - Reason: ${voidReason.trim()}`,
          createdBy: user.id,
          createdAt: now,
        })
      );
    }
  }

  voidStatements.push(
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "SALE_VOIDED",
      entityType: "sale",
      entityId: saleId,
      details: JSON.stringify({ voidReason, invoiceNumber: sale.invoiceNumber }),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    })
  );

  await db.batch(voidStatements as any);

  return c.json({ success: true });
});
