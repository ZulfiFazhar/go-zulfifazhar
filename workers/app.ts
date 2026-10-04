import { Hono } from "hono";
import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/context";

const app = new Hono<{ Bindings: Env }>();

// Add more routes here

app.get("*", (c) => {
  const requestHandler = createRequestHandler(
    () => import("virtual:react-router/server-build"),
    import.meta.env.MODE,
  );

  const routerContext = new RouterContextProvider();
  routerContext.set(cloudflareContext, {
    env: c.env,
    ctx: c.executionCtx,
  });

  return requestHandler(c.req.raw, routerContext);
});

export default app;
