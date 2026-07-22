import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` reads the schema and emits SQL migrations (no DB needed).
// Migrations are applied against Cloud SQL by scripts/db-migrate.ts (via the
// connector), so no plaintext connection string lives in this config.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./lib/db/schema.ts", "./lib/db/memory-schema.ts"],
  out: "./drizzle",
});
