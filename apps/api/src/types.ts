import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { AuthUser } from "@aev/shared";

export interface Env {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  ENVIRONMENT: string;
  SESSION_SECRET: string;
  COOKIE_DOMAIN?: string;
  ASSETS?: Fetcher;
}

export interface AppVariables {
  user?: AuthUser;
}

export type AppContext = {
  Bindings: Env;
  Variables: AppVariables;
};
