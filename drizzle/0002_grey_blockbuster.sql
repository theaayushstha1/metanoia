CREATE TABLE "refunds" (
	"payment_id" text PRIMARY KEY NOT NULL,
	"refund_id" text NOT NULL,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "payment_method_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_updated_at" bigint;