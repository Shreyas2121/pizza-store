import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { URL } from "../constants";
import { logger } from "../utils/logger";

const isNeon = URL.includes("neon.tech") || URL.includes("sslmode=require");

/**
 * Strips password and sensitive credentials from database connection string for safe logging.
 */
export const getMaskedDbUrl = (connStr: string): string => {
  try {
    const parsed = new globalThis.URL(connStr);
    if (parsed.password) {
      parsed.password = "******";
    }
    return parsed.toString();
  } catch {
    return connStr.replace(/:([^:@]+)@/, ":******@");
  }
};

export const pool = new Pool({
  connectionString: URL,
  ...(isNeon ? { ssl: { rejectUnauthorized: false } } : {}),
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  logger.error(`❌ [Database Pool] Unexpected error on idle PostgreSQL client: ${err.message}`, {
    error: err,
  });
});

/**
 * Tests database connectivity, measures latency, and logs detailed diagnostic info.
 */
export const checkDatabaseConnection = async (): Promise<boolean> => {
  const startTime = Date.now();
  const maskedUrl = getMaskedDbUrl(URL);

  logger.info(`⏳ [Database] Attempting connection to PostgreSQL (${maskedUrl})...`);

  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT current_database() AS db_name, version() AS db_version, NOW() AS server_time"
    );
    client.release();

    const duration = Date.now() - startTime;
    const dbName = result.rows[0]?.db_name || "unknown";
    const rawVersion = result.rows[0]?.db_version || "PostgreSQL";
    const versionSnippet = rawVersion.split(" ").slice(0, 2).join(" ");
    const isCloudNeon = URL.includes("neon.tech");

    logger.info(
      `✅ [Database] Connected successfully in ${duration}ms | Database: "${dbName}" | Engine: ${versionSnippet}${
        isCloudNeon ? " (Neon Cloud)" : ""
      }`
    );
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(
      `❌ [Database] Connection failed after ${duration}ms: ${error?.message || error}`
    );
    if (error?.code) {
      logger.error(`❌ [Database] Error Code: ${error.code}`);
    }
    logger.error(
      `💡 [Database] Tip: Verify network connectivity, check if Neon database is active, and ensure DATABASE_URL in .env is correct.`
    );
    return false;
  }
};

export const db = drizzle(pool, {
  schema,
});

export const closeDatabase = () => pool.end();
