import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { URL } from "../constants";

const isNeon = URL.includes("neon.tech") || URL.includes("sslmode=require");

const pool = new Pool({
  connectionString: URL,
  ...(isNeon ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const db = drizzle(pool, {
  schema,
});