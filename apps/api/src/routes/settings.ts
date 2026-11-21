import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { requireOwner } from "../middleware/auth";
import { showrooms, auditLogs, updateSettingsSchema } from "@aev/shared";

export const settingsRoutes = new Hono<AppContext>();

// Get showroom settings
settingsRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const showroomList = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, user.showroomId))
    .limit(1);

  const showroom = showroomList[0];
  if (!showroom) {
    return c.json({ error: "Showroom not found" }, 404);
  }

  // Parse allowedDurations JSON safely
  let allowedDurations = [3, 6, 9, 12];
  try {
    allowedDurations = JSON.parse(showroom.allowedDurations || "[3,6,9,12]");
  } catch {
    allowedDurations = [3, 6, 9, 12];
  }

  return c.json({
    settings: {
      ...showroom,
      allowedDurations,
    },
  });
});

// Update showroom settings (Owner only)
settingsRoutes.put("/", requireOwner, zValidator("json", updateSettingsSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  const [existing] = await db
    .select()
    .from(showrooms)
    .where(eq(showrooms.id, user.showroomId))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Showroom not found" }, 404);
  }

  const now = new Date();

  await db.batch([
    db
      .update(showrooms)
      .set({
        name: data.name,
        address: data.address,
        phoneNumbers: data.phoneNumbers,
        email: data.email || null,
        invoicePrefix: data.invoicePrefix.toUpperCase(),
        receiptPrefix: data.receiptPrefix.toUpperCase(),
        invoiceFooterText: data.invoiceFooterText || null,
        defaultWarrantyTerms: data.defaultWarrantyTerms || null,
        minDownPaymentType: data.minDownPaymentType,
        minDownPaymentValue: data.minDownPaymentValue,
        defaultMarkupType: data.defaultMarkupType,
        defaultMarkupValue: data.defaultMarkupValue,
        allowedDurations: JSON.stringify(data.allowedDurations),
        lateFineEnabled: data.lateFineEnabled,
        lateFineType: data.lateFineType,
        lateFineAmount: data.lateFineAmount,
        lateFineGraceDays: data.lateFineGraceDays,
        guarantorEnabled: data.guarantorEnabled,
        updatedAt: now,
      })
      .where(eq(showrooms.id, user.showroomId)),

    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "SETTINGS_UPDATED",
      entityType: "settings",
      entityId: user.showroomId,
      details: JSON.stringify({
        updatedBy: user.email,
        changes: data,
      }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true });
});

// Upload showroom logo to R2 (Owner only)
settingsRoutes.post("/logo", requireOwner, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const file = body["logo"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "Valid logo image file is required" }, 400);
  }

  const fileExt = file.name.split(".").pop() || "png";
  const logoKey = `logos/showroom-${user.showroomId}-${Date.now()}.${fileExt}`;

  // Store in R2 bucket
  await c.env.DOCUMENTS.put(logoKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "image/png",
    },
    customMetadata: {
      showroomId: user.showroomId,
      uploadedBy: user.id,
    },
  });

  const db = createDb(c.env.DB);
  await db.batch([
    db
      .update(showrooms)
      .set({ logoR2Key: logoKey, updatedAt: new Date() })
      .where(eq(showrooms.id, user.showroomId)),

    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "LOGO_UPDATED",
      entityType: "settings",
      entityId: user.showroomId,
      details: JSON.stringify({ logoKey }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, logoR2Key: logoKey });
});

// Serve document / logo from R2
settingsRoutes.get("/file/:key{.*}", async (c) => {
  const key = c.req.param("key");
  if (!key) return c.json({ error: "Missing file key" }, 400);

  const object = await c.env.DOCUMENTS.get(key);
  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  return c.body(object.body as any, 200, {
    "Content-Type": contentType,
    "ETag": object.httpEtag,
    "Cache-Control": "public, max-age=86400",
  });
});
