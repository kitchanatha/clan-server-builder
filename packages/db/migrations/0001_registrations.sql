CREATE TABLE IF NOT EXISTS "registrations" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"ign" text NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
