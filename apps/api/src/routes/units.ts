import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, inArray } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { requireOwner } from "../middleware/auth";
import {
  units,
  models,
  brands,
  suppliers,
  supplierTransactions,
  auditLogs,
  batchStockInSchema,
} from "@aev/shared";

export const unitRoutes = new Hono<AppContext>();

// List inventory units with model, brand, supplier
unitRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const statusParam = c.req.query("status"); // 'in_stock' | 'sold' | 'returned'
  const search = c.req.query("search")?.toUpperCase().trim();
  const db = createDb(c.env.DB);

  let query = db
    .select({
      id: units.id,
      chassisNumber: units.chassisNumber,
      motorNumber: units.motorNumber,
      batterySerialNumbers: units.batterySerialNumbers,
      color: units.color,
      purchaseCost: units.purchaseCost,
      status: units.status,
      receivedDate: units.receivedDate,
      soldAt: units.soldAt,
      modelId: models.id,
      modelName: models.name,
      variant: models.variant,
      defaultSellingPrice: models.defaultSellingPrice,
      brandId: brands.id,
      brandName: brands.name,
      supplierId: suppliers.id,
      supplierName: suppliers.name,
    })
    .from(units)
    .innerJoin(models, eq(units.modelId, models.id))
    .innerJoin(brands, eq(models.brandId, brands.id))
    .innerJoin(suppliers, eq(units.supplierId, suppliers.id))
    .where(eq(units.showroomId, user.showroomId))
    .orderBy(desc(units.receivedDate));

  const allUnits = await query;

  // Filter in memory for simplicity or status filtering
  let filtered = allUnits;
  if (statusParam && ["in_stock", "sold", "returned"].includes(statusParam)) {
    filtered = filtered.filter((u) => u.status === statusParam);
  }
  if (search) {
    filtered = filtered.filter(
      (u) =>
        u.chassisNumber.toUpperCase().includes(search) ||
        u.motorNumber.toUpperCase().includes(search) ||
        u.color.toUpperCase().includes(search) ||
        u.modelName.toUpperCase().includes(search) ||
        u.brandName.toUpperCase().includes(search)
    );
  }

  // HARD TECHNICAL RULE: Staff cannot see purchase cost. Mask for non-owners.
  const isOwner = user.role === "owner";
  const sanitized = filtered.map((u) => ({
    ...u,
    purchaseCost: isOwner ? u.purchaseCost : undefined,
  }));

  return c.json({ units: sanitized });
});

// Single unit details
unitRoutes.get("/:id", async (c) => {
  const user = c.get("user")!;
  const unitId = c.req.param("id");
  const db = createDb(c.env.DB);

  const [unit] = await db
    .select({
      id: units.id,
      chassisNumber: units.chassisNumber,
      motorNumber: units.motorNumber,
      batterySerialNumbers: units.batterySerialNumbers,
      color: units.color,
      purchaseCost: units.purchaseCost,
      status: units.status,
      receivedDate: units.receivedDate,
      soldAt: units.soldAt,
      modelId: models.id,
      modelName: models.name,
      variant: models.variant,
      defaultSellingPrice: models.defaultSellingPrice,
      brandId: brands.id,
      brandName: brands.name,
      supplierId: suppliers.id,
      supplierName: suppliers.name,
    })
    .from(units)
    .innerJoin(models, eq(units.modelId, models.id))
    .innerJoin(brands, eq(models.brandId, brands.id))
    .innerJoin(suppliers, eq(units.supplierId, suppliers.id))
    .where(and(eq(units.id, unitId), eq(units.showroomId, user.showroomId)))
    .limit(1);

  if (!unit) {
    return c.json({ error: "Unit not found" }, 404);
  }

  const isOwner = user.role === "owner";
  return c.json({
    unit: {
      ...unit,
      purchaseCost: isOwner ? unit.purchaseCost : undefined,
    },
  });
});

// Rapid Batch Stock-in (Mobile friendly)
unitRoutes.post("/stock-in", zValidator("json", batchStockInSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  // Validate model and supplier exist
  const [model] = await db
    .select()
    .from(models)
    .where(and(eq(models.id, data.modelId), eq(models.showroomId, user.showroomId)))
    .limit(1);

  if (!model) return c.json({ error: "Model not found" }, 400);

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, data.supplierId), eq(suppliers.showroomId, user.showroomId)))
    .limit(1);

  if (!supplier) return c.json({ error: "Supplier not found" }, 400);

  // Check duplicate chassis numbers within the incoming batch
  const chassisSet = new Set<string>();
  for (const item of data.units) {
    const chassis = item.chassisNumber.toUpperCase().trim();
    if (chassisSet.has(chassis)) {
      return c.json({ error: `Duplicate chassis number in batch: ${chassis}` }, 400);
    }
    chassisSet.add(chassis);
  }

  // Check if any chassis number already exists in showroom
  const existingUnits = await db
    .select({ chassisNumber: units.chassisNumber })
    .from(units)
    .where(
      and(
        eq(units.showroomId, user.showroomId),
        inArray(units.chassisNumber, Array.from(chassisSet))
      )
    );

  if (existingUnits.length > 0) {
    return c.json(
      {
        error: `Chassis number(s) already in stock: ${existingUnits.map((u) => u.chassisNumber).join(", ")}`,
      },
      400
    );
  }

  const now = new Date();
  const receivedDate = new Date(data.receivedDate);

  let totalPurchaseCost = 0;
  const batchStatements: any[] = [];
  const createdUnitIds: string[] = [];

  for (const item of data.units) {
    const unitId = crypto.randomUUID();
    createdUnitIds.push(unitId);
    totalPurchaseCost += item.purchaseCost;

    batchStatements.push(
      db.insert(units).values({
        id: unitId,
        showroomId: user.showroomId,
        modelId: data.modelId,
        supplierId: data.supplierId,
        chassisNumber: item.chassisNumber.toUpperCase().trim(),
        motorNumber: item.motorNumber.toUpperCase().trim(),
        batterySerialNumbers: item.batterySerialNumbers.trim(),
        color: item.color.trim(),
        purchaseCost: item.purchaseCost,
        status: "in_stock",
        receivedDate,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  // Automatically record the purchase in supplier ledger
  const supplierTxId = crypto.randomUUID();
  batchStatements.push(
    db.insert(supplierTransactions).values({
      id: supplierTxId,
      showroomId: user.showroomId,
      supplierId: data.supplierId,
      type: "purchase",
      amount: totalPurchaseCost,
      reference: `Stock-in ${data.units.length} units (${model.name})`,
      notes: `Batch stock-in chassis: ${Array.from(chassisSet).slice(0, 3).join(", ")}${chassisSet.size > 3 ? "..." : ""}`,
      transactionDate: receivedDate,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
  );

  // Audit log entry
  batchStatements.push(
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "STOCK_IN_BATCH",
      entityType: "unit",
      entityId: createdUnitIds[0] || "batch",
      details: JSON.stringify({
        unitCount: data.units.length,
        modelId: data.modelId,
        modelName: model.name,
        supplierId: data.supplierId,
        supplierName: supplier.name,
        totalCost: totalPurchaseCost,
        chassisNumbers: Array.from(chassisSet),
      }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    })
  );

  // Execute atomically via db.batch()
  await db.batch(batchStatements as any);

  return c.json(
    {
      success: true,
      count: data.units.length,
      supplierTransactionId: supplierTxId,
    },
    201
  );
});

// Update unit status (Owner only: e.g. mark returned)
unitRoutes.patch("/:id/status", requireOwner, async (c) => {
  const user = c.get("user")!;
  const unitId = c.req.param("id");
  const { status, reason } = await c.req.json<{ status: "in_stock" | "sold" | "returned"; reason?: string }>();

  if (!["in_stock", "sold", "returned"].includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const db = createDb(c.env.DB);
  const [existing] = await db
    .select()
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.showroomId, user.showroomId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Unit not found" }, 404);
  }

  const now = new Date();

  await db.batch([
    db
      .update(units)
      .set({ status, updatedAt: now })
      .where(and(eq(units.id, unitId), eq(units.showroomId, user.showroomId))),

    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "UNIT_STATUS_CHANGED",
      entityType: "unit",
      entityId: unitId,
      details: JSON.stringify({
        chassisNumber: existing.chassisNumber,
        oldStatus: existing.status,
        newStatus: status,
        reason: reason || null,
      }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true });
});
