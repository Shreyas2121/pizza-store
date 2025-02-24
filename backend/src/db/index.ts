import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema'
import { URL } from '../constants';

export const db = drizzle(URL, {
    schema
})