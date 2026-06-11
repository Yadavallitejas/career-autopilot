import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const planEnum = pgEnum("plan", ["free", "pro", "team"]);

export const achievementStatusEnum = pgEnum("achievement_status", [
  "processing",
  "classified",
  "complete",
  "failed",
]);

export const platformEnum = pgEnum("platform", ["linkedin", "x"]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "approved",
  "published",
  "failed",
]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").unique().notNull(),
    email: text("email").notNull(),
    plan: planEnum("plan").notNull().default("free"),
    voiceProfile: jsonb("voice_profile"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    clerkIdIdx: index("users_clerk_id_idx").on(t.clerkId),
  })
);

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export const achievements = pgTable(
  "achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawInput: text("raw_input").notNull(),
    classifiedResumeWorthy: boolean("classified_resume_worthy"),
    classifiedPortfolioWorthy: boolean("classified_portfolio_worthy"),
    resumeScore: integer("resume_score"),
    portfolioScore: integer("portfolio_score"),
    achievementType: text("achievement_type"),
    reasoning: text("reasoning"),
    resumeBullet: text("resume_bullet"),
    resumeSection: text("resume_section"),
    status: achievementStatusEnum("status").notNull().default("processing"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("achievements_user_id_idx").on(t.userId),
    statusIdx: index("achievements_status_idx").on(t.status),
  })
);

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    draftText: text("draft_text").notNull(),
    hashtags: text("hashtags").array().default([]),
    mediaUrls: text("media_urls").array().default([]),
    mediaPrompt: text("media_prompt"),
    status: postStatusEnum("status").notNull().default("draft"),
    publishedUrl: text("published_url"),
    errorMessage: text("error_message"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    achievementIdIdx: index("posts_achievement_id_idx").on(t.achievementId),
  })
);

// ---------------------------------------------------------------------------
// Resume Versions
// ---------------------------------------------------------------------------

export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull().default("classic"),
    fileUrl: text("file_url").notNull(),
    rawText: text("raw_text").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    changesSummary: text("changes_summary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("resume_versions_user_id_idx").on(t.userId),
  })
);

// ---------------------------------------------------------------------------
// Portfolio Config
// ---------------------------------------------------------------------------

export const portfolioConfig = pgTable("portfolio_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  githubRepoUrl: text("github_repo_url"),
  githubRepoId: bigint("github_repo_id", { mode: "number" }),
  deployPlatform: text("deploy_platform"),
  deployUrl: text("deploy_url"),
  projectType: text("project_type"),
  template: text("template").notNull().default("minimal"),
  platformProjectId: text("platform_project_id"),
  lastDeployed: timestamp("last_deployed"),
});

// ---------------------------------------------------------------------------
// Connected Accounts
// ---------------------------------------------------------------------------

export const connectedAccounts = pgTable("connected_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  platformUserId: text("platform_user_id"),
  platformUsername: text("platform_username"),
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  razorpaySubId: text("razorpay_sub_id"),
  razorpayOrderId: text("razorpay_order_id"),
  plan: text("plan").notNull(),
  billingCycle: text("billing_cycle").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Coach Conversations
// ---------------------------------------------------------------------------

export const coachConversations = pgTable("coach_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  messages: jsonb("messages").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  achievements: many(achievements),
  resumeVersions: many(resumeVersions),
  connectedAccounts: many(connectedAccounts),
  coachConversations: many(coachConversations),
  portfolioConfig: one(portfolioConfig, {
    fields: [users.id],
    references: [portfolioConfig.userId],
  }),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
}));

export const achievementsRelations = relations(
  achievements,
  ({ one, many }) => ({
    user: one(users, { fields: [achievements.userId], references: [users.id] }),
    posts: many(posts),
  })
);

export const postsRelations = relations(posts, ({ one }) => ({
  achievement: one(achievements, {
    fields: [posts.achievementId],
    references: [achievements.id],
  }),
}));

export const resumeVersionsRelations = relations(resumeVersions, ({ one }) => ({
  user: one(users, {
    fields: [resumeVersions.userId],
    references: [users.id],
  }),
}));

export const portfolioConfigRelations = relations(
  portfolioConfig,
  ({ one }) => ({
    user: one(users, {
      fields: [portfolioConfig.userId],
      references: [users.id],
    }),
  })
);

export const connectedAccountsRelations = relations(
  connectedAccounts,
  ({ one }) => ({
    user: one(users, {
      fields: [connectedAccounts.userId],
      references: [users.id],
    }),
  })
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const coachConversationsRelations = relations(
  coachConversations,
  ({ one }) => ({
    user: one(users, {
      fields: [coachConversations.userId],
      references: [users.id],
    }),
  })
);

// ---------------------------------------------------------------------------
// TypeScript Types
// ---------------------------------------------------------------------------

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Achievement = InferSelectModel<typeof achievements>;
export type NewAchievement = InferInsertModel<typeof achievements>;

export type Post = InferSelectModel<typeof posts>;
export type NewPost = InferInsertModel<typeof posts>;

export type ResumeVersion = InferSelectModel<typeof resumeVersions>;
export type NewResumeVersion = InferInsertModel<typeof resumeVersions>;

export type PortfolioConfig = InferSelectModel<typeof portfolioConfig>;
export type NewPortfolioConfig = InferInsertModel<typeof portfolioConfig>;

export type ConnectedAccount = InferSelectModel<typeof connectedAccounts>;
export type NewConnectedAccount = InferInsertModel<typeof connectedAccounts>;

export type Subscription = InferSelectModel<typeof subscriptions>;
export type NewSubscription = InferInsertModel<typeof subscriptions>;

export type CoachConversation = InferSelectModel<typeof coachConversations>;
export type NewCoachConversation = InferInsertModel<typeof coachConversations>;
