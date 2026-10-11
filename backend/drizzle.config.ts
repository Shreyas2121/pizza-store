import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const migrationUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!migrationUrl) throw new Error('DATABASE_MIGRATION_URL or DATABASE_URL is required for migrations');

export default defineConfig({
    out: './migrations',
    schema: './src/db/schema/index.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: migrationUrl
    }
})
