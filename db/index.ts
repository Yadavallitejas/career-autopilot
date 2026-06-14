import { env } from "@/lib/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

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
