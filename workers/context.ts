export interface Env {
  SHORTENER_DB: D1Database;
  SHORTENER_CACHE: KVNamespace;
  BASE_URL: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  VALUE_FROM_CLOUDFLARE?: string;
}

export interface UserSession {
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface AppVariables {
  user?: UserSession | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
