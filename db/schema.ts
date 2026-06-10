import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  json,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const planEnum = pgEnum("plan", ["free", "pro", "team"]);

export const achievementStatusEnum = pgEnum("achievement_status", [
  "processing",
  "complete",
  "failed",
]);

export const achievementTypeEnum = pgEnum("achievement_type", [
  "certification",
  "project",
  "award",
  "job_change",
  "education",
  "open_source",
  "publication",
  "other",
]);

export const postPlatformEnum = pgEnum("post_platform", ["linkedin", "x"]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "published",
  "failed",
  "skipped",
]);

export const deployStatusEnum = pgEnum("deploy_status", [
  "pending",
  "deploying",
  "live",
  "failed",
]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // Clerk userId
    email: text("email").notNull(),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    plan: planEnum("plan").notNull().default("free"),
    planExpiresAt: timestamp("plan_expires_at"),
    razorpayCustomerId: text("razorpay_customer_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

// ---------------------------------------------------------------------------
// Connected Accounts
// ---------------------------------------------------------------------------

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // "linkedin" | "github"
    platformUserId: text("platform_user_id").notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    expiresAt: timestamp("expires_at"),
    scopes: text("scopes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userPlatformIdx: uniqueIndex("connected_accounts_user_platform_idx").on(
      t.userId,
      t.platform
    ),
  })
);

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export const achievements = pgTable(
  "achievements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    status: achievementStatusEnum("status").notNull().default("processing"),
    type: achievementTypeEnum("type"),
    resumeScore: integer("resume_score"),
    portfolioScore: integer("portfolio_score"),
    resumeReasoning: text("resume_reasoning"),
    portfolioReasoning: text("portfolio_reasoning"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("achievements_user_id_idx").on(t.userId),
  })
);

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: postPlatformEnum("platform").notNull(),
    content: text("content").notNull(),
    hashtags: json("hashtags").$type<string[]>().default([]),
    mediaSuggestion: text("media_suggestion"),
    status: postStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at"),
    platformPostId: text("platform_post_id"),
    platformPostUrl: text("platform_post_url"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    achievementIdx: index("posts_achievement_id_idx").on(t.achievementId),
    userIdIdx: index("posts_user_id_idx").on(t.userId),
  })
);

// ---------------------------------------------------------------------------
// Resume Versions
// ---------------------------------------------------------------------------

export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").references(() => achievements.id),
    resumeData: json("resume_data").notNull(), // ResumeData JSON
    isCurrent: boolean("is_current").notNull().default(false),
    pdfUrl: text("pdf_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("resume_versions_user_id_idx").on(t.userId),
  })
);

// ---------------------------------------------------------------------------
// Portfolio Deployments
// ---------------------------------------------------------------------------

export const portfolioDeployments = pgTable(
  "portfolio_deployments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").references(() => achievements.id),
    repoFullName: text("repo_full_name").notNull(),
    platform: text("platform").notNull(),
    projectType: text("project_type").notNull(),
    deployUrl: text("deploy_url"),
    status: deployStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    deployedAt: timestamp("deployed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index("portfolio_deployments_user_id_idx").on(t.userId),
  })
);

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  monthlySummaryEmail: boolean("monthly_summary_email").notNull().default(true),
  brandVoiceProfile: json("brand_voice_profile"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  achievements: many(achievements),
  posts: many(posts),
  resumeVersions: many(resumeVersions),
  portfolioDeployments: many(portfolioDeployments),
  connectedAccounts: many(connectedAccounts),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
}));

export const achievementsRelations = relations(achievements, ({ one, many }) => ({
  user: one(users, { fields: [achievements.userId], references: [users.id] }),
  posts: many(posts),
  resumeVersion: one(resumeVersions, {
    fields: [achievements.id],
    references: [resumeVersions.achievementId],
  }),
  portfolioDeployment: one(portfolioDeployments, {
    fields: [achievements.id],
    references: [portfolioDeployments.achievementId],
  }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  achievement: one(achievements, {
    fields: [posts.achievementId],
    references: [achievements.id],
  }),
  user: one(users, { fields: [posts.userId], references: [users.id] }),
}));
