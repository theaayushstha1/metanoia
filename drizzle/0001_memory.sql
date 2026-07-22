CREATE SCHEMA "memory";
--> statement-breakpoint
CREATE TABLE "memory"."procurement_events" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"capability" text NOT NULL,
	"plan_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"amount_cents" integer,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory"."profile_consent" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"granted" boolean DEFAULT false NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory"."profile_facts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text,
	"value" text NOT NULL,
	"source" text DEFAULT 'inferred' NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory"."profile_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"connected_at" bigint NOT NULL
);
