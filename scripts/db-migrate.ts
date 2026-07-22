/**
 * Apply Drizzle migrations to Cloud SQL through the connector (same IAM auth as the
 * app + Vertex agent — no proxy, no IP allowlist). Run with:
 *   npm run db:migrate
 *
 * Requires CLOUD_SQL_CONNECTION_NAME, CLOUD_SQL_DATABASE, CLOUD_SQL_USER,
 * CLOUD_SQL_PASSWORD in the environment (the npm script loads .env.local).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";

async function main() {
  const instanceConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
  if (!instanceConnectionName || !process.env.CLOUD_SQL_DATABASE) {
    throw new Error("Set CLOUD_SQL_CONNECTION_NAME and CLOUD_SQL_DATABASE before migrating.");
  }

  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName,
    ipType: IpAddressTypes.PUBLIC,
  });
  const pool = new Pool({
    ...clientOpts,
    user: process.env.CLOUD_SQL_USER ?? "postgres",
    password: process.env.CLOUD_SQL_PASSWORD,
    database: process.env.CLOUD_SQL_DATABASE,
    max: 1,
  });

  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  connector.close();
  console.log("✓ migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
