import { createMiddleware } from "hono/factory";
import { getCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../../context";
import { verifySessionJwt } from "./auth.service";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, "auth_session");
  if (!token) {
    c.set("user", null);
    return next();
  }

  const user = await verifySessionJwt(token, c.env.JWT_SECRET);
  if (user) {
    c.set("user", user);
  } else {
    // Clear invalid, tampered, or expired session cookie cleanly
    deleteCookie(c, "auth_session", { path: "/" });
    c.set("user", null);
  }

  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  let user = c.get("user");
  if (user === undefined) {
    const token = getCookie(c, "auth_session");
    if (token) {
      user = await verifySessionJwt(token, c.env.JWT_SECRET);
      if (!user) {
        deleteCookie(c, "auth_session", { path: "/" });
      }
    }
    c.set("user", user ?? null);
  }

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});
