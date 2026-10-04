import { createContext } from "react-router";

export interface CloudflareAppContext {
  env: Env;
  ctx: {
    waitUntil: (promise: Promise<unknown>) => void;
    passThroughOnException: () => void;
  };
}

export const cloudflareContext = createContext<CloudflareAppContext>();
