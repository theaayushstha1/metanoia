/**
 * Cloud SQL (Postgres) connection, reached through the Cloud SQL Connector.
 *
 * The connector opens an IAM-authenticated TLS socket to the instance by its
 * connection name (project:region:instance) using the SAME Google credentials the
 * Vertex agent uses — ADC locally, a service-account JSON on Vercel. No public IP,
 * no allowlisting Vercel's rotating egress IPs.
 *
 * The pool + drizzle handle are initialized once (a memoized promise) and reused
 * across warm serverless invocations under Fluid Compute.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

/** True when the app is configured to use durable Postgres (vs the in-memory store). */
export function pgConfigured(): boolean {
  return Boolean(process.env.CLOUD_SQL_CONNECTION_NAME && process.env.CLOUD_SQL_DATABASE);
}

let dbPromise: Promise<DB> | null = null;

async function init(): Promise<DB> {
  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME!,
    ipType: IpAddressTypes.PUBLIC,
  });
  const pool = new Pool({
    ...clientOpts,
    user: process.env.CLOUD_SQL_USER ?? "postgres",
    password: process.env.CLOUD_SQL_PASSWORD,
    database: process.env.CLOUD_SQL_DATABASE,
    max: 5,
  });
  return drizzle(pool, { schema });
}

export function getDb(): Promise<DB> {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}
