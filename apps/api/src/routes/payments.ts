import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, asc, ne } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import {
  payments,
  sales,
  installmentPlans,
  installmentSchedules,
  paymentAllocations,
  accounts,
  accountTransactions,
  showrooms,
  counters,
  auditLogs,
  createPaymentSchema,
  waiveFineSchema,
} from "@aev/shared";

export const paymentRoutes = new Hono<AppContext>();

// ============================================================================
// POST /api/payments — Record a new payment against a sale
// ============================================================================
paymentRoutes.post("/", zValidator("json", createPaymentSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();
  const currentYear = new Date().getFullYear();

  // 1. Confirm sale exists, is not voided, belongs to this showroom
  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, data.saleId), eq(sales.showroomId, user.showroomId)))
    .limit(1);

  if (!sale) return c.json({ error: "Sale not found" }, 404);
  if (sale.isVoided) return c.json({ error: "Cannot record payment on a voided sale" }, 400);

  // 2. Compute remaining balance dynamically (never stored)
  const existingPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.saleId, data.saleId));

  const totalPaid = existingPayments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = Math.max(0, sale.totalAmount - totalPaid);

  if (data.amount > remaining) {
    return c.json(
      { error: `Payment amount (${data.amount}) exceeds remaining balance (${remaining})` },
      400
    );
  }

  // 3. Get showroom for receipt prefix
  const [showroom] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, user.showroomId))
    .limit(1);

  if (!showroom) return c.json({ error: "Showroom not found" }, 500);

  // Validate receiving account
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, data.accountId), eq(accounts.showroomId, user.showroomId)))
    .limit(1);

  if (!account) return c.json({ error: "Selected account not found" }, 404);
  if (!account.isActive) return c.json({ error: "Cannot receive payment into an inactive account" }, 400);

  // Rule 5: Derive / align payment method from account
  let paymentMethod = data.paymentMethod;
  if (account.type === "cash") {
    paymentMethod = "cash";
  } else if (account.type === "bank") {
    paymentMethod = "bank_transfer";
  }

  // 4. Receipt counter
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

  const nextReceiptSeq = (receiptCounterRow?.lastSequence ?? 0) + 1;
  const receiptNumber = `${showroom.receiptPrefix}-${currentYear}-${String(nextReceiptSeq).padStart(4, "0")}`;
  const receiptCounterId = `cnt_rec_${currentYear}`;

  const paymentId = crypto.randomUUID();
  const paymentDate = new Date(data.paymentDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batchStatements: any[] = [];

  // Receipt counter update/insert
  if (receiptCounterRow) {
    batchStatements.push(
      db.update(counters)
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

  // Payment insert
  batchStatements.push(
    db.insert(payments).values({
      id: paymentId,
      showroomId: user.showroomId,
      saleId: data.saleId,
      receiptNumber,
      accountId: account.id,
      paymentDate,
      amount: Math.round(data.amount),
      paymentMethod,
      reference: data.reference?.trim() ?? null,
      notes: data.notes?.trim() ?? null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
  );

  // Inflow into account_transactions ledger
  batchStatements.push(
    db.insert(accountTransactions).values({
      id: `tx_pay_${paymentId}`,
      showroomId: user.showroomId,
      accountId: account.id,
      date: paymentDate,
      direction: "in",
      amount: Math.round(data.amount),
      type: "customer_payment",
      category: sale.saleType === "installment" ? "Installment Payment" : "Full Payment",
      referenceType: "payment",
      referenceId: paymentId,
      notes: `Customer payment receipt ${receiptNumber} against ${sale.invoiceNumber}`,
      createdBy: user.id,
      createdAt: now,
    })
  );

  // 5. For installment sales: allocate to schedules greedily (oldest first)
  const allocationRows: { scheduleId: string; allocatedAmount: number }[] = [];
  const scheduleUpdates: { id: string; newStatus: "paid" | "partially_paid"; paidAt: Date | null }[] = [];

  if (sale.saleType === "installment") {
    const [plan] = await db
      .select()
      .from(installmentPlans)
      .where(eq(installmentPlans.saleId, data.saleId))
      .limit(1);

    if (plan) {
      const unpaidSchedules = await db
        .select()
        .from(installmentSchedules)
        .where(
          and(
            eq(installmentSchedules.installmentPlanId, plan.id),
            ne(installmentSchedules.status, "paid")
          )
        )
        .orderBy(asc(installmentSchedules.installmentNumber));

      // Compute already-allocated amounts per schedule
      const scheduleIds = unpaidSchedules.map((s) => s.id);
      let priorAllocations: { installmentScheduleId: string; allocatedAmount: number }[] = [];
      if (scheduleIds.length > 0) {
        priorAllocations = await db
          .select({
            installmentScheduleId: paymentAllocations.installmentScheduleId,
            allocatedAmount: paymentAllocations.allocatedAmount,
          })
          .from(paymentAllocations)
          .where(
            // Filter to only relevant schedules — use a plain eq loop aggregation
            eq(paymentAllocations.showroomId, user.showroomId)
          );
      }

      // Build a map of already-paid per schedule
      const paidPerSchedule = new Map<string, number>();
      for (const alloc of priorAllocations) {
        const prev = paidPerSchedule.get(alloc.installmentScheduleId) ?? 0;
        paidPerSchedule.set(alloc.installmentScheduleId, prev + alloc.allocatedAmount);
      }

      let leftToAllocate = Math.round(data.amount);

      for (const sched of unpaidSchedules) {
        if (leftToAllocate <= 0) break;

        const alreadyPaid = paidPerSchedule.get(sched.id) ?? 0;
        const scheduleOwed = Math.max(0, sched.amount - alreadyPaid);
        if (scheduleOwed <= 0) continue;

        const toAllocate = Math.min(leftToAllocate, scheduleOwed);
        leftToAllocate -= toAllocate;

        allocationRows.push({ scheduleId: sched.id, allocatedAmount: toAllocate });

        const newPaid = alreadyPaid + toAllocate;
        const newStatus: "paid" | "partially_paid" = newPaid >= sched.amount ? "paid" : "partially_paid";
        scheduleUpdates.push({
          id: sched.id,
          newStatus,
          paidAt: newStatus === "paid" ? now : null,
        });
      }

      // Insert allocation rows
      for (const alloc of allocationRows) {
        batchStatements.push(
          db.insert(paymentAllocations).values({
            id: crypto.randomUUID(),
            showroomId: user.showroomId,
            paymentId,
            installmentScheduleId: alloc.scheduleId,
            allocatedAmount: alloc.allocatedAmount,
            fineAllocatedAmount: 0,
            createdAt: now,
          })
        );
      }

      // Update schedule statuses
      for (const upd of scheduleUpdates) {
        batchStatements.push(
          db.update(installmentSchedules)
            .set({ status: upd.newStatus, paidAt: upd.paidAt ?? undefined, updatedAt: now })
            .where(eq(installmentSchedules.id, upd.id))
        );
      }
    }
  }

  // Audit log
  batchStatements.push(
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "PAYMENT_RECORDED",
      entityType: "payment",
      entityId: paymentId,
      details: JSON.stringify({
        saleId: data.saleId,
        receiptNumber,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        allocations: allocationRows.length,
      }),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    })
  );

  await db.batch(batchStatements as unknown as Parameters<typeof db.batch>[0]);

  return c.json({ success: true, paymentId, receiptNumber }, 201);
});

// ============================================================================
// GET /api/payments/:id — Single payment with receipt data for printing
// ============================================================================
paymentRoutes.get("/:id", async (c) => {
  const user = c.get("user")!;
  const paymentId = c.req.param("id");
  const db = createDb(c.env.DB);

  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.showroomId, user.showroomId)))
    .limit(1);

  if (!payment) return c.json({ error: "Payment not found" }, 404);

  const [sale] = await db
    .select()
    .from(sales)
    .where(eq(sales.id, payment.saleId))
    .limit(1);

  const [showroom] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, user.showroomId))
    .limit(1);

  const allocations = await db
    .select()
    .from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId));

  return c.json({ payment, sale: sale ?? null, showroom: showroom ?? null, allocations });
});

// ============================================================================
// POST /api/payments/:id/waive-fine — Waive fine on a schedule (owner only)
// ============================================================================
paymentRoutes.post("/:id/waive-fine", zValidator("json", waiveFineSchema), async (c) => {
  const user = c.get("user")!;

  if (user.role !== "owner") {
    return c.json({ error: "Only owners can waive fines" }, 403);
  }

  const { installmentScheduleId } = c.req.valid("json");
  const db = createDb(c.env.DB);
  const now = new Date();

  const [schedule] = await db
    .select()
    .from(installmentSchedules)
    .where(
      and(
        eq(installmentSchedules.id, installmentScheduleId),
        eq(installmentSchedules.showroomId, user.showroomId)
      )
    )
    .limit(1);

  if (!schedule) return c.json({ error: "Installment schedule not found" }, 404);
  if (schedule.fineWaived) return c.json({ error: "Fine already waived" }, 400);

  await db.batch([
    db.update(installmentSchedules)
      .set({ fineWaived: true, fineAmount: 0, updatedAt: now })
      .where(eq(installmentSchedules.id, installmentScheduleId)),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "FINE_WAIVED",
      entityType: "installment_schedule",
      entityId: installmentScheduleId,
      details: JSON.stringify({
        scheduleId: installmentScheduleId,
        previousFineAmount: schedule.fineAmount,
      }),
      ipAddress: c.req.header("cf-connecting-ip") ?? "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true });
});
