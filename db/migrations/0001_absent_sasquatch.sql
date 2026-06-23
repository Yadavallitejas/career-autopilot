ALTER TABLE "posts" ALTER COLUMN "hashtags" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "media_urls" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "resume_rules" jsonb;