import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppContext } from "../types";
import { createDb } from "../db";
import { validateSession } from "../lib/auth";

export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
  const token = getCookie(c, "aev_session");
  if (!token) {
    return c.json({ error: "Unauthorized: Please log in" }, 401);
  }

  const db = createDb(c.env.DB);
  const user = await validateSession(db, token);
  if (!user) {
    return c.json({ error: "Unauthorized: Invalid or expired session" }, 401);
  }

  c.set("user", user);
  return await next();
});

export const requireOwner = createMiddleware<AppContext>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (user.role !== "owner") {
    return c.json({ error: "Forbidden: Owner access required" }, 403);
  }

  return await next();
});
