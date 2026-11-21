import { Hono } from "hono";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { requireOwner } from "../middleware/auth";
import {
  sales,
  units,
  models,
  brands,
  payments,
  customers,
  suppliers,
  supplierTransactions,
  toCSV,
  formatPKTDate,
} from "@aev/shared";

export const reportRoutes = new Hono<AppContext>();

// ============================================================================
// 1. Sales Report (Filtered by Date Range, CSV or JSON)
// Staff can view; only Owner sees purchaseCost & profit
// ============================================================================
reportRoutes.get("/sales", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);
  const isOwner = user.role === "owner";

  const fromQuery = c.req.query("from");
  const toQuery = c.req.query("to");
  const format = c.req.query("format");

  // Default to past 30 days if unspecified
  const now = new Date();
  const fromDate = fromQuery ? new Date(fromQuery) : new Date(now.getTime() - 30 * 86400 * 1000);
  const toDate = toQuery ? new Date(toQuery) : now;

  // Add 1 day to toDate so it covers the entire day inclusive
  const toDateInclusive = new Date(toDate.getTime() + 86400 * 1000);

  const fromSeconds = Math.floor(fromDate.getTime() / 1000);
  const toSeconds = Math.floor(toDateInclusive.getTime() / 1000);

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
      customerName: sales.customerNameSnap,
      customerPhone: sales.customerPhoneSnap,
      unitBrand: sales.unitBrandSnap,
      unitModel: sales.unitModelSnap,
      unitChassis: sales.unitChassisSnap,
      unitCost: isOwner ? units.purchaseCost : sql<number>`0`,
      totalPaid: sql<number>`COALESCE((
        SELECT SUM(amount) FROM payments
        WHERE payments.sale_id = ${sales.id}
      ), 0)`,
    })
    .from(sales)
    .innerJoin(units, eq(sales.unitId, units.id))
    .where(
      and(
        eq(sales.showroomId, user.showroomId),
        sql`${sales.saleDate} >= ${fromSeconds} AND ${sales.saleDate} <= ${toSeconds}`
      )
    )
    .orderBy(desc(sales.saleDate));

  const items = saleRows.map((s) => {
    const paid = Number(s.totalPaid || 0);
    const balance = Math.max(0, s.totalAmount - paid);
    const cost = Number(s.unitCost || 0);
    const profit = s.isVoided ? 0 : s.totalAmount - cost;
    const profitMargin = cost > 0 && !s.isVoided ? Math.round((profit / cost) * 100) : 0;

    return {
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      saleType: s.saleType,
      saleDate: s.saleDate,
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      unitBrand: s.unitBrand,
      unitModel: s.unitModel,
      unitChassis: s.unitChassis,
      basePrice: s.basePrice,
      discount: s.discount,
      totalAmount: s.totalAmount,
      totalPaid: paid,
      remainingBalance: balance,
      isVoided: s.isVoided,
      ...(isOwner ? { unitCost: cost, profit, profitMargin } : {}),
    };
  });

  const summary = {
    totalSales: items.filter((i) => !i.isVoided).length,
    totalRevenue: items.filter((i) => !i.isVoided).reduce((s, i) => s + i.totalAmount, 0),
    totalCollected: items.filter((i) => !i.isVoided).reduce((s, i) => s + i.totalPaid, 0),
    totalReceivable: items.filter((i) => !i.isVoided).reduce((s, i) => s + i.remainingBalance, 0),
    ...(isOwner
      ? {
          totalProfit: items.filter((i) => !i.isVoided).reduce((s, i) => s + (i.profit || 0), 0),
        }
      : {}),
  };

  if (format === "csv") {
    const headers = isOwner
      ? [
          "Invoice #",
          "Date",
          "Type",
          "Customer",
          "Phone",
          "Scooty",
          "Chassis",
          "Base Price (PKR)",
          "Discount (PKR)",
          "Total (PKR)",
          "Paid (PKR)",
          "Balance (PKR)",
          "Cost (PKR)",
          "Profit (PKR)",
          "Margin %",
          "Status",
        ]
      : [
          "Invoice #",
          "Date",
          "Type",
          "Customer",
          "Phone",
          "Scooty",
          "Chassis",
          "Base Price (PKR)",
          "Discount (PKR)",
          "Total (PKR)",
          "Paid (PKR)",
          "Balance (PKR)",
          "Status",
        ];

    const rows = items.map((i) => {
      const baseRow = [
        i.invoiceNumber,
        formatPKTDate(i.saleDate),
        i.saleType === "installment" ? "Installment" : "Full Payment",
        i.customerName,
        i.customerPhone,
        `${i.unitBrand} ${i.unitModel}`,
        i.unitChassis,
        i.basePrice,
        i.discount,
        i.totalAmount,
        i.totalPaid,
        i.remainingBalance,
      ];

      if (isOwner) {
        return [
          ...baseRow,
          i.unitCost || 0,
          i.profit || 0,
          `${i.profitMargin || 0}%`,
          i.isVoided ? "VOIDED" : "ACTIVE",
        ];
      }
      return [...baseRow, i.isVoided ? "VOIDED" : "ACTIVE"];
    });

    const csvData = toCSV(headers, rows);
    return new Response(csvData, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sales_report_${fromQuery || "all"}_${toQuery || "all"}.csv"`,
      },
    });
  }

  return c.json({ items, summary });
});

// ============================================================================
// 2. Stock Valuation Report (Owner Only)
// ============================================================================
reportRoutes.get("/stock-valuation", requireOwner, async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);
  const format = c.req.query("format");

  const stockUnits = await db
    .select({
      id: units.id,
      chassisNumber: units.chassisNumber,
      motorNumber: units.motorNumber,
      color: units.color,
      purchaseCost: units.purchaseCost,
      receivedDate: units.receivedDate,
      brandName: brands.name,
      modelName: models.name,
      variant: models.variant,
      defaultSellingPrice: models.defaultSellingPrice,
      supplierName: suppliers.name,
    })
    .from(units)
    .innerJoin(models, eq(units.modelId, models.id))
    .innerJoin(brands, eq(models.brandId, brands.id))
    .innerJoin(suppliers, eq(units.supplierId, suppliers.id))
    .where(and(eq(units.showroomId, user.showroomId), eq(units.status, "in_stock")))
    .orderBy(brands.name, models.name, units.receivedDate);

  const items = stockUnits.map((u) => {
    const cost = Number(u.purchaseCost);
    const retail = Number(u.defaultSellingPrice);
    const potentialProfit = retail - cost;
    const margin = cost > 0 ? Math.round((potentialProfit / cost) * 100) : 0;

    return {
      ...u,
      purchaseCost: cost,
      defaultSellingPrice: retail,
      potentialProfit,
      margin,
    };
  });

  const totalCost = items.reduce((s, i) => s + i.purchaseCost, 0);
  const totalRetail = items.reduce((s, i) => s + i.defaultSellingPrice, 0);
  const totalProjectedProfit = totalRetail - totalCost;

  const summary = {
    totalUnits: items.length,
    totalValuationAtCost: totalCost,
    totalValuationAtRetail: totalRetail,
    totalProjectedProfit,
    overallMarginPercent: totalCost > 0 ? Math.round((totalProjectedProfit / totalCost) * 100) : 0,
  };

  if (format === "csv") {
    const headers = [
      "Brand",
      "Model",
      "Color",
      "Chassis Number",
      "Motor Number",
      "Supplier",
      "Date Received",
      "Purchase Cost (PKR)",
      "Retail Price (PKR)",
      "Projected Profit (PKR)",
      "Margin %",
    ];

    const rows = items.map((i) => [
      i.brandName,
      i.modelName + (i.variant ? ` (${i.variant})` : ""),
      i.color,
      i.chassisNumber,
      i.motorNumber,
      i.supplierName,
      formatPKTDate(i.receivedDate),
      i.purchaseCost,
      i.defaultSellingPrice,
      i.potentialProfit,
      `${i.margin}%`,
    ]);

    const csvData = toCSV(headers, rows);
    return new Response(csvData, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="stock_valuation_report.csv"',
      },
    });
  }

  return c.json({ items, summary });
});

// ============================================================================
// 3. Profit Per Sale Report (Owner Only)
// ============================================================================
reportRoutes.get("/profit-per-sale", requireOwner, async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);
  const format = c.req.query("format");

  const fromQuery = c.req.query("from");
  const toQuery = c.req.query("to");

  const now = new Date();
  const fromDate = fromQuery ? new Date(fromQuery) : new Date(now.getTime() - 30 * 86400 * 1000);
  const toDate = toQuery ? new Date(toQuery) : now;
  const toDateInclusive = new Date(toDate.getTime() + 86400 * 1000);

  const fromSeconds = Math.floor(fromDate.getTime() / 1000);
  const toSeconds = Math.floor(toDateInclusive.getTime() / 1000);

  const saleRows = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      saleDate: sales.saleDate,
      saleType: sales.saleType,
      customerName: sales.customerNameSnap,
      unitBrand: sales.unitBrandSnap,
      unitModel: sales.unitModelSnap,
      unitChassis: sales.unitChassisSnap,
      basePrice: sales.basePrice,
      discount: sales.discount,
      markupAmount: sales.markupAmount,
      totalAmount: sales.totalAmount,
      purchaseCost: units.purchaseCost,
      isVoided: sales.isVoided,
    })
    .from(sales)
    .innerJoin(units, eq(sales.unitId, units.id))
    .where(
      and(
        eq(sales.showroomId, user.showroomId),
        eq(sales.isVoided, false),
        sql`${sales.saleDate} >= ${fromSeconds} AND ${sales.saleDate} <= ${toSeconds}`
      )
    )
    .orderBy(desc(sales.saleDate));

  const items = saleRows.map((s) => {
    const cost = Number(s.purchaseCost || 0);
    const revenue = Number(s.totalAmount);
    const netProfit = revenue - cost;
    const margin = cost > 0 ? Math.round((netProfit / cost) * 100) : 0;

    return {
      invoiceNumber: s.invoiceNumber,
      saleDate: s.saleDate,
      saleType: s.saleType,
      customerName: s.customerName,
      unit: `${s.unitBrand} ${s.unitModel}`,
      chassisNumber: s.unitChassis,
      basePrice: s.basePrice,
      discount: s.discount,
      markupAmount: s.markupAmount,
      totalRevenue: revenue,
      purchaseCost: cost,
      netProfit,
      marginPercent: margin,
    };
  });

  const totalRev = items.reduce((s, i) => s + i.totalRevenue, 0);
  const totalCost = items.reduce((s, i) => s + i.purchaseCost, 0);
  const totalProfit = totalRev - totalCost;

  const summary = {
    totalSales: items.length,
    totalRevenue: totalRev,
    totalCost,
    totalProfit,
    overallMarginPercent: totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0,
  };

  if (format === "csv") {
    const headers = [
      "Invoice #",
      "Sale Date",
      "Type",
      "Customer",
      "Scooty",
      "Chassis #",
      "Selling Price (PKR)",
      "Unit Cost (PKR)",
      "Net Profit (PKR)",
      "Margin %",
    ];

    const rows = items.map((i) => [
      i.invoiceNumber,
      formatPKTDate(i.saleDate),
      i.saleType === "installment" ? "Installment" : "Full Payment",
      i.customerName,
      i.unit,
      i.chassisNumber,
      i.totalRevenue,
      i.purchaseCost,
      i.netProfit,
      `${i.marginPercent}%`,
    ]);

    const csvData = toCSV(headers, rows);
    return new Response(csvData, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="profit_per_sale_report.csv"',
      },
    });
  }

  return c.json({ items, summary });
});

// ============================================================================
// 4. Customer Ledger Report
// ============================================================================
reportRoutes.get("/customer-ledger/:customerId", async (c) => {
  const user = c.get("user")!;
  const customerId = c.req.param("customerId");
  const db = createDb(c.env.DB);
  const format = c.req.query("format");

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.showroomId, user.showroomId)))
    .limit(1);

  if (!customer) return c.json({ error: "Customer not found" }, 404);

  // Sales (Debits)
  const customerSales = await db
    .select()
    .from(sales)
    .where(and(eq(sales.customerId, customerId), eq(sales.showroomId, user.showroomId)))
    .orderBy(asc(sales.saleDate));

  // Payments (Credits)
  const customerPayments = await db
    .select({
      payment: payments,
      sale: sales,
    })
    .from(payments)
    .innerJoin(sales, eq(payments.saleId, sales.id))
    .where(and(eq(sales.customerId, customerId), eq(payments.showroomId, user.showroomId)))
    .orderBy(asc(payments.paymentDate));

  // Combine into single chronological ledger
  type LedgerEntry = {
    id: string;
    date: number;
    type: "SALE" | "PAYMENT" | "VOID";
    reference: string;
    description: string;
    debit: number; // Sale amount (owed)
    credit: number; // Payment amount (paid)
    balance: number; // Running balance
  };

  const entries: LedgerEntry[] = [];

  for (const s of customerSales) {
    if (s.isVoided) {
      entries.push({
        id: s.id,
        date: s.saleDate.getTime() / 1000,
        type: "VOID",
        reference: s.invoiceNumber,
        description: `Sale VOIDED (${s.unitBrandSnap} ${s.unitModelSnap}) - Reason: ${s.voidReason || "N/A"}`,
        debit: 0,
        credit: 0,
        balance: 0,
      });
    } else {
      entries.push({
        id: s.id,
        date: s.saleDate.getTime() / 1000,
        type: "SALE",
        reference: s.invoiceNumber,
        description: `Scooty Purchase: ${s.unitBrandSnap} ${s.unitModelSnap} (Chassis: ${s.unitChassisSnap})`,
        debit: s.totalAmount,
        credit: 0,
        balance: 0,
      });
    }
  }

  for (const p of customerPayments) {
    entries.push({
      id: p.payment.id,
      date: p.payment.paymentDate.getTime() / 1000,
      type: "PAYMENT",
      reference: p.payment.receiptNumber,
      description: `Payment received against ${p.sale.invoiceNumber} via ${p.payment.paymentMethod}${
        p.payment.reference ? ` (Ref: ${p.payment.reference})` : ""
      }`,
      debit: 0,
      credit: p.payment.amount,
      balance: 0,
    });
  }

  // Sort chronologically
  entries.sort((a, b) => a.date - b.date);

  // Compute running balance
  let running = 0;
  for (const entry of entries) {
    running += entry.debit - entry.credit;
    entry.balance = running;
  }

  const totalBilled = entries.reduce((s, e) => s + e.debit, 0);
  const totalPaid = entries.reduce((s, e) => s + e.credit, 0);
  const currentBalance = totalBilled - totalPaid;

  if (format === "csv") {
    const headers = ["Date", "Type", "Reference", "Description", "Debit (PKR)", "Credit (PKR)", "Balance (PKR)"];
    const rows = entries.map((e) => [
      formatPKTDate(e.date),
      e.type,
      e.reference,
      e.description,
      e.debit,
      e.credit,
      e.balance,
    ]);

    const csvData = toCSV(headers, rows);
    return new Response(csvData, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ledger_${customer.name.replace(/\s+/g, "_")}.csv"`,
      },
    });
  }

  return c.json({
    customer,
    entries,
    summary: {
      totalBilled,
      totalPaid,
      currentBalance,
    },
  });
});

// ============================================================================
// 5. Supplier Ledger Report
// ============================================================================
reportRoutes.get("/supplier-ledger/:supplierId", async (c) => {
  const user = c.get("user")!;
  const supplierId = c.req.param("supplierId");
  const db = createDb(c.env.DB);
  const format = c.req.query("format");

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.showroomId, user.showroomId)))
    .limit(1);

  if (!supplier) return c.json({ error: "Supplier not found" }, 404);

  const transactions = await db
    .select()
    .from(supplierTransactions)
    .where(
      and(
        eq(supplierTransactions.supplierId, supplierId),
        eq(supplierTransactions.showroomId, user.showroomId)
      )
    )
    .orderBy(asc(supplierTransactions.transactionDate));

  let running = 0;
  const entries = transactions.map((t) => {
    // purchase increases what showroom owes (credit to supplier)
    // payment decreases what showroom owes (debit to supplier)
    const isPurchase = t.type === "purchase";
    const debit = isPurchase ? 0 : t.amount;
    const credit = isPurchase ? t.amount : 0;
    running += credit - debit;

    return {
      id: t.id,
      date: t.transactionDate,
      type: t.type,
      reference: t.reference || "N/A",
      notes: t.notes || "",
      debit,
      credit,
      balance: running,
    };
  });

  const totalPurchases = entries.reduce((s, e) => s + e.credit, 0);
  const totalPaid = entries.reduce((s, e) => s + e.debit, 0);
  const currentPayable = totalPurchases - totalPaid;

  if (format === "csv") {
    const headers = ["Date", "Type", "Reference", "Notes", "Paid/Debit (PKR)", "Purchases/Credit (PKR)", "Payable Balance (PKR)"];
    const rows = entries.map((e) => [
      formatPKTDate(e.date),
      e.type.toUpperCase(),
      e.reference,
      e.notes,
      e.debit,
      e.credit,
      e.balance,
    ]);

    const csvData = toCSV(headers, rows);
    return new Response(csvData, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="supplier_ledger_${supplier.name.replace(/\s+/g, "_")}.csv"`,
      },
    });
  }

  return c.json({
    supplier,
    entries,
    summary: {
      totalPurchases,
      totalPaid,
      currentPayable,
    },
  });
});
