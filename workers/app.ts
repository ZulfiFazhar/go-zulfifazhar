import { Hono } from "hono";
import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/context";
import type { AppEnv } from "./context";
import { authRoutes } from "./modules/auth/auth.controller";
import { linksRoutes, userLinksRoutes, handleGetPublicStats } from "./modules/links/links.controller";
import { handleEdgeRedirect } from "./modules/redirect/redirect.controller";

const app = new Hono<AppEnv>();

// API modular routes
app.get("/api/stats/public", handleGetPublicStats);
app.route("/api/auth", authRoutes);
app.route("/api/links", linksRoutes);
app.route("/api/user/links", userLinksRoutes);

// High-speed edge redirect handler
app.get("/:slug", async (c, next) => {
  const redirectResponse = await handleEdgeRedirect(c);
  if (redirectResponse) {
    return redirectResponse;
  }
  return next();
});

// React Router SSR fallback handler
app.get("*", async (c) => {
  try {
    const requestHandler = createRequestHandler(
      () => import("virtual:react-router/server-build"),
      import.meta.env.MODE,
    );

    let executionCtx: any;
    try {
      executionCtx = c.executionCtx;
    } catch {
      executionCtx = {
        waitUntil: () => {},
        passThroughOnException: () => {},
      };
    }

    const routerContext = new RouterContextProvider();
    routerContext.set(cloudflareContext, {
      env: c.env as any,
      ctx: executionCtx,
    });

    return await requestHandler(c.req.raw, routerContext);
  } catch (err) {
    console.error("SSR rendering error:", err);
    return c.text("Internal Server Error", 500);
  }
});

export default app;
