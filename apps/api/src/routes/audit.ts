import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { requireOwner } from "../middleware/auth";
import { auditLogs, users } from "@aev/shared";

export const auditRoutes = new Hono<AppContext>();

auditRoutes.use("*", requireOwner);

// GET /api/audit — Paginated audit log viewer
auditRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const db = createDb(c.env.DB);

  const actionFilter = c.req.query("action");
  const limitParam = Number(c.req.query("limit") || 50);
  const offsetParam = Number(c.req.query("offset") || 0);

  const conditions = [eq(auditLogs.showroomId, user.showroomId)];
  if (actionFilter) {
    conditions.push(eq(auditLogs.action, actionFilter));
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(${auditLogs.id})` })
    .from(auditLogs)
    .where(whereClause);

  const total = Number(countResult?.count || 0);

  // Get paginated rows
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
      userFullName: users.fullName,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limitParam)
    .offset(offsetParam);

  return c.json({
    logs: rows,
    pagination: {
      total,
      limit: limitParam,
      offset: offsetParam,
      hasMore: offsetParam + limitParam < total,
    },
  });
});
