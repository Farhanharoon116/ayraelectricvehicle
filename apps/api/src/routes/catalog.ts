import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { requireOwner } from "../middleware/auth";
import {
  brands,
  models,
  auditLogs,
  createBrandSchema,
  createModelSchema,
} from "@aev/shared";

export const catalogRoutes = new Hono<AppContext>();

// List all brands
catalogRoutes.get("/brands", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const brandList = await db
    .select({
      id: brands.id,
      name: brands.name,
      createdAt: brands.createdAt,
    })
    .from(brands)
    .where(eq(brands.showroomId, user.showroomId))
    .orderBy(brands.name);

  return c.json({ brands: brandList });
});

// Create brand (Owner only)
catalogRoutes.post("/brands", requireOwner, zValidator("json", createBrandSchema), async (c) => {
  const user = c.get("user")!;
  const { name } = c.req.valid("json");
  const db = createDb(c.env.DB);

  const brandId = crypto.randomUUID();
  const now = new Date();

  await db.batch([
    db.insert(brands).values({
      id: brandId,
      showroomId: user.showroomId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "BRAND_CREATED",
      entityType: "brand",
      entityId: brandId,
      details: JSON.stringify({ name }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, brandId }, 201);
});

// List all models with brand info and in-stock count
catalogRoutes.get("/models", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const modelRows = await db
    .select({
      id: models.id,
      brandId: models.brandId,
      brandName: brands.name,
      name: models.name,
      variant: models.variant,
      colorOptions: models.colorOptions,
      batteryCapacity: models.batteryCapacity,
      rangeKm: models.rangeKm,
      defaultSellingPrice: models.defaultSellingPrice,
      isActive: models.isActive,
      createdAt: models.createdAt,
      inStockCount: sql<number>`(
        SELECT COUNT(*) FROM units
        WHERE units.model_id = ${models.id}
        AND units.status = 'in_stock'
      )`,
    })
    .from(models)
    .innerJoin(brands, eq(models.brandId, brands.id))
    .where(eq(models.showroomId, user.showroomId))
    .orderBy(brands.name, models.name);

  const formatted = modelRows.map((m) => {
    let colors: string[] = [];
    try {
      colors = JSON.parse(m.colorOptions);
    } catch {
      colors = [];
    }
    return {
      ...m,
      colorOptions: colors,
      inStockCount: Number(m.inStockCount || 0),
    };
  });

  return c.json({ models: formatted });
});

// Create model (Owner only)
catalogRoutes.post("/models", requireOwner, zValidator("json", createModelSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  const modelId = crypto.randomUUID();
  const now = new Date();

  await db.batch([
    db.insert(models).values({
      id: modelId,
      showroomId: user.showroomId,
      brandId: data.brandId,
      name: data.name.trim(),
      variant: data.variant?.trim() || null,
      colorOptions: JSON.stringify(data.colorOptions),
      batteryCapacity: data.batteryCapacity?.trim() || null,
      rangeKm: data.rangeKm || null,
      defaultSellingPrice: data.defaultSellingPrice,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "MODEL_CREATED",
      entityType: "model",
      entityId: modelId,
      details: JSON.stringify({
        name: data.name,
        brandId: data.brandId,
        defaultSellingPrice: data.defaultSellingPrice,
      }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, modelId }, 201);
});

// Update model (Owner only)
catalogRoutes.put("/models/:id", requireOwner, zValidator("json", createModelSchema), async (c) => {
  const user = c.get("user")!;
  const modelId = c.req.param("id");
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  const [existing] = await db
    .select()
    .from(models)
    .where(and(eq(models.id, modelId), eq(models.showroomId, user.showroomId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Model not found" }, 404);
  }

  const now = new Date();
  const priceChanged = existing.defaultSellingPrice !== data.defaultSellingPrice;

  const batchCalls = [
    db
      .update(models)
      .set({
        brandId: data.brandId,
        name: data.name.trim(),
        variant: data.variant?.trim() || null,
        colorOptions: JSON.stringify(data.colorOptions),
        batteryCapacity: data.batteryCapacity?.trim() || null,
        rangeKm: data.rangeKm || null,
        defaultSellingPrice: data.defaultSellingPrice,
        updatedAt: now,
      })
      .where(and(eq(models.id, modelId), eq(models.showroomId, user.showroomId))),

    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: priceChanged ? "PRICE_CHANGED" : "MODEL_UPDATED",
      entityType: "model",
      entityId: modelId,
      details: JSON.stringify({
        modelName: data.name,
        oldPrice: existing.defaultSellingPrice,
        newPrice: data.defaultSellingPrice,
        priceChanged,
      }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ];

  await db.batch(batchCalls as any);

  return c.json({ success: true });
});
