CREATE TABLE IF NOT EXISTS "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"configured_by" text NOT NULL,
	"config" jsonb NOT NULL,
	"bot_installed" boolean DEFAULT false NOT NULL,
	"provision_status" text DEFAULT 'idle' NOT NULL,
	"provision_error" text,
	"provisioned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"guild_id" text NOT NULL,
	"key" text NOT NULL,
	"discord_id" text NOT NULL,
	CONSTRAINT "resources_guild_id_key_pk" PRIMARY KEY("guild_id","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"ign" text NOT NULL,
	"class_name" text NOT NULL,
	"power" integer DEFAULT 0 NOT NULL,
	"playtime" text DEFAULT '' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"ign" text NOT NULL,
	"class_name" text NOT NULL,
	"power" integer DEFAULT 0 NOT NULL,
	"playtime" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_id" text,
	"message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"avatar" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_guild_user_idx" ON "applications" USING btree ("guild_id","user_id");
