import { env } from "@/lib/env";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type Database = typeof db;

// Table references
export const {
  users,
  achievements,
  posts,
  resumeVersions,
  portfolioConfig,
  connectedAccounts,
  subscriptions,
  coachConversations,
} = schema;
