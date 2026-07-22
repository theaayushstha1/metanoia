CREATE TABLE "attempts" (
	"payment_id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method_id" text,
	"applied_event_ts" bigint,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"credential" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"plan_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text,
	"payment_id" text,
	"raw" jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"received_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"customer_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"merchant_name" text NOT NULL,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "subscriptions_customer_id_plan_id_pk" PRIMARY KEY("customer_id","plan_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_owner_idx" ON "credentials" USING btree ("customer_id","plan_id");