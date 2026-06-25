DO $$ BEGIN
 CREATE TYPE "public"."resume_source" AS ENUM('uploaded', 'built', 'none');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "resume_source" "resume_source" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auto_apply_resume_updates" boolean DEFAULT false NOT NULL;