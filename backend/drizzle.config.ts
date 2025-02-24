import { defineConfig } from 'drizzle-kit';
import { URL } from './src/constants';

export default defineConfig({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: URL
    }
})