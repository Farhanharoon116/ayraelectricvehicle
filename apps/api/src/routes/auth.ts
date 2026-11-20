import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { hashPassword, verifyPassword, createSession, deleteSession, validateSession } from "../lib/auth";
import { users, auditLogs, loginSchema, createUserSchema, resetPasswordSchema } from "@aev/shared";

export const authRoutes = new Hono<AppContext>();

const SESSION_COOKIE_NAME = "aev_session";

// Session check endpoint
authRoutes.get("/me", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ user: null }, 200);
  }

  const db = createDb(c.env.DB);
  const user = await validateSession(db, token);
  return c.json({ user }, 200);
});

// Login endpoint
authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const db = createDb(c.env.DB);

  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  const user = existingUsers[0];
  if (!user || !user.isActive) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const sessionToken = await createSession(db, user.id, user.showroomId);

  setCookie(c, SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  // Log successful login to audit log
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    showroomId: user.showroomId,
    userId: user.id,
    action: "LOGIN",
    entityType: "user",
    entityId: user.id,
    details: JSON.stringify({ email: user.email }),
    ipAddress: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown",
    userAgent: c.req.header("user-agent"),
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      showroomId: user.showroomId,
    },
  });
});

// Logout endpoint
authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    const db = createDb(c.env.DB);
    await deleteSession(db, token);
  }

  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
  });

  return c.json({ success: true });
});

// List showroom users (owner only)
authRoutes.get("/users", async (c) => {
  const authUser = c.get("user");
  if (!authUser || authUser.role !== "owner") {
    return c.json({ error: "Forbidden: Owner access required" }, 403);
  }

  const db = createDb(c.env.DB);
  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.showroomId, authUser.showroomId));

  return c.json({ users: userList });
});

// Create staff user (owner only)
authRoutes.post("/users", zValidator("json", createUserSchema), async (c) => {
  const authUser = c.get("user");
  if (!authUser || authUser.role !== "owner") {
    return c.json({ error: "Forbidden: Owner access required" }, 403);
  }

  const data = c.req.valid("json");
  const db = createDb(c.env.DB);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "A user with this email already exists" }, 400);
  }

  const passwordHash = await hashPassword(data.password);
  const newUserId = crypto.randomUUID();

  await db.insert(users).values({
    id: newUserId,
    showroomId: authUser.showroomId,
    email: data.email.toLowerCase().trim(),
    passwordHash,
    role: data.role,
    fullName: data.fullName,
    phone: data.phone || null,
    isActive: true,
  });

  return c.json({ success: true, userId: newUserId }, 201);
});

// Reset password (owner only)
authRoutes.post("/users/reset-password", zValidator("json", resetPasswordSchema), async (c) => {
  const authUser = c.get("user");
  if (!authUser || authUser.role !== "owner") {
    return c.json({ error: "Forbidden: Owner access required" }, 403);
  }

  const { userId, newPassword } = c.req.valid("json");
  const db = createDb(c.env.DB);

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return c.json({ success: true });
});
