import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv, UserSession } from "../../context";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  signSessionJwt,
} from "./auth.service";
import { authMiddleware } from "./auth.middleware";
import { findUserByEmail, upsertUserRecord } from "../../db/queries";

export function getCallbackUrl(baseUrl?: string, requestUrl?: string): string {
  const origin = baseUrl || (requestUrl ? new URL(requestUrl).origin : "");
  return `${origin.replace(/\/+$/, "")}/api/auth/callback`;
}

export async function handleGoogleAuth(c: Context<AppEnv>) {
  const state = crypto.randomUUID();
  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    secure: c.req.url.startsWith("https://"),
    sameSite: "Lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const redirectUri = getCallbackUrl(c.env.BASE_URL, c.req.url);
  const authUrl = buildGoogleAuthUrl({
    clientId: c.env.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
  });

  return c.redirect(authUrl);
}

export async function handleGoogleCallback(c: Context<AppEnv>) {
  const error = c.req.query("error");
  if (error) {
    deleteCookie(c, "oauth_state", { path: "/" });
    return c.redirect("/?error=" + encodeURIComponent(error));
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedState = getCookie(c, "oauth_state");
  deleteCookie(c, "oauth_state", { path: "/" });

  if (!state || !storedState || state !== storedState) {
    return c.json({ error: "Invalid state" }, 400);
  }

  if (!code) {
    return c.json({ error: "Missing authorization code" }, 400);
  }

  try {
    const redirectUri = getCallbackUrl(c.env.BASE_URL, c.req.url);
    const tokens = await exchangeGoogleCode(
      code,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const googleUser = await fetchGoogleUserInfo(tokens.access_token);
    if (!googleUser.email) {
      return c.json({ error: "Google account has no email" }, 400);
    }

    const existingUser = await findUserByEmail(c.env.SHORTENER_DB, googleUser.email);
    const userId = existingUser?.id || googleUser.id || crypto.randomUUID();

    const userRecord = await upsertUserRecord(c.env.SHORTENER_DB, {
      id: userId,
      email: googleUser.email,
      name: googleUser.name ?? null,
      avatar_url: googleUser.picture ?? null,
    });

    const session: UserSession = {
      userId: userRecord.id,
      email: userRecord.email,
      name: userRecord.name ?? undefined,
      avatarUrl: userRecord.avatar_url ?? undefined,
    };

    const token = await signSessionJwt(session, c.env.JWT_SECRET);

    setCookie(c, "auth_session", token, {
      httpOnly: true,
      secure: c.req.url.startsWith("https://"),
      sameSite: "Lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return c.redirect("/dashboard");
  } catch (err: any) {
    return c.json({ error: err?.message || "Authentication failed" }, 500);
  }
}

export function handleMe(c: Context<AppEnv>) {
  return c.json({ user: c.get("user") || null });
}

export function handleLogout(c: Context<AppEnv>) {
  deleteCookie(c, "auth_session", { path: "/" });
  return c.redirect("/");
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.use("*", authMiddleware);

authRoutes.get("/google", handleGoogleAuth);
authRoutes.get("/callback", handleGoogleCallback);
authRoutes.get("/me", handleMe);
authRoutes.post("/logout", handleLogout);
authRoutes.get("/logout", handleLogout);
