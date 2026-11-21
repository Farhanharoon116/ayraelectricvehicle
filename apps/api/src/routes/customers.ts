import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, sql } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import {
  customers,
  sales,
  auditLogs,
  customerSchema,
} from "@aev/shared";

export const customerRoutes = new Hono<AppContext>();

// List & search customers (by name, phone, or CNIC)
customerRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const q = c.req.query("q")?.trim();
  const db = createDb(c.env.DB);

  let query = db
    .select({
      id: customers.id,
      name: customers.name,
      fatherOrHusbandName: customers.fatherOrHusbandName,
      cnic: customers.cnic,
      phone: customers.phone,
      address: customers.address,
      cnicFrontR2Key: customers.cnicFrontR2Key,
      cnicBackR2Key: customers.cnicBackR2Key,
      notes: customers.notes,
      createdAt: customers.createdAt,
      totalPurchases: sql<number>`COALESCE((
        SELECT COUNT(*) FROM sales
        WHERE sales.customer_id = ${customers.id}
        AND sales.is_voided = 0
      ), 0)`,
    })
    .from(customers)
    .where(eq(customers.showroomId, user.showroomId))
    .orderBy(desc(customers.createdAt));

  let results = await query;

  if (q) {
    const lower = q.toLowerCase();
    results = results.filter(
      (cust) =>
        cust.name.toLowerCase().includes(lower) ||
        cust.phone.includes(lower) ||
        cust.cnic.includes(lower)
    );
  }

  return c.json({ customers: results });
});

// Single customer with purchase history
customerRoutes.get("/:id", async (c) => {
  const user = c.get("user")!;
  const customerId = c.req.param("id");
  const db = createDb(c.env.DB);

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.showroomId, user.showroomId)))
    .limit(1);

  if (!customer) {
    return c.json({ error: "Customer not found" }, 404);
  }

  const customerSales = await db
    .select()
    .from(sales)
    .where(and(eq(sales.customerId, customerId), eq(sales.showroomId, user.showroomId)))
    .orderBy(desc(sales.saleDate));

  return c.json({ customer, sales: customerSales });
});

// Create customer (checks CNIC duplication within showroom)
customerRoutes.post("/", zValidator("json", customerSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  // Check if CNIC already exists in showroom
  const [existing] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.showroomId, user.showroomId), eq(customers.cnic, data.cnic.trim())))
    .limit(1);

  if (existing) {
    return c.json(
      {
        error: "A customer with this CNIC already exists",
        customerId: existing.id,
      },
      400
    );
  }

  const customerId = crypto.randomUUID();
  const now = new Date();

  await db.batch([
    db.insert(customers).values({
      id: customerId,
      showroomId: user.showroomId,
      name: data.name.trim(),
      fatherOrHusbandName: data.fatherOrHusbandName?.trim() || null,
      cnic: data.cnic.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      notes: data.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      showroomId: user.showroomId,
      userId: user.id,
      action: "CUSTOMER_CREATED",
      entityType: "customer",
      entityId: customerId,
      details: JSON.stringify({ name: data.name, cnic: data.cnic, phone: data.phone }),
      ipAddress: c.req.header("cf-connecting-ip") || "unknown",
      userAgent: c.req.header("user-agent"),
    }),
  ]);

  return c.json({ success: true, customerId }, 201);
});

// Upload CNIC photo (front or back) to R2
customerRoutes.post("/:id/cnic-photo", async (c) => {
  const user = c.get("user")!;
  const customerId = c.req.param("id");
  const body = await c.req.parseBody();
  const side = (body["side"] as string) || "front"; // 'front' or 'back'
  const file = body["photo"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "Photo file is required" }, 400);
  }

  const db = createDb(c.env.DB);
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.showroomId, user.showroomId)))
    .limit(1);

  if (!customer) {
    return c.json({ error: "Customer not found" }, 404);
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const r2Key = `customers/${user.showroomId}/${customerId}-cnic-${side}-${Date.now()}.${fileExt}`;

  await c.env.DOCUMENTS.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
    customMetadata: { customerId, side, showroomId: user.showroomId },
  });

  const updateField = side === "back" ? { cnicBackR2Key: r2Key } : { cnicFrontR2Key: r2Key };

  await db
    .update(customers)
    .set({ ...updateField, updatedAt: new Date() })
    .where(and(eq(customers.id, customerId), eq(customers.showroomId, user.showroomId)));

  return c.json({ success: true, r2Key });
});
