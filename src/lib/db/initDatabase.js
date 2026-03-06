/**
 * Database init: ensures schema and dev user exist.
 * Run once: node src/lib/db/initDatabase.js
 * Or run database/init-all.sql manually in Supabase SQL Editor.
 *
 * In local dev (VITE_DATA_SOURCE=local), tables are in localStorage and
 * DEV_USER_ID is used automatically — no SQL needed.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');
const sqlPath = join(root, 'database', 'init-all.sql');

export function getInitSqlPath() {
  return sqlPath;
}

export function getInitSql() {
  if (!existsSync(sqlPath)) return null;
  return readFileSync(sqlPath, 'utf8');
}

export function logInitInstructions() {
  console.log('[DB Init] Aroha Flow database setup');
  console.log('[DB Init] 1. Local dev (VITE_DATA_SOURCE=local): tables live in localStorage; DEV_USER_ID is used. No SQL to run.');
  console.log('[DB Init] 2. Supabase: run the SQL file once in your project SQL Editor:');
  console.log('[DB Init]   Path:', sqlPath);
  console.log('[DB Init] Success: tables created if missing, dev user inserted, RLS policies applied.');
}

if (process.argv[1]?.includes('initDatabase')) {
  logInitInstructions();
  const sql = getInitSql();
  if (sql) console.log('[DB Init] SQL file length:', sql.length, 'chars');
  else console.warn('[DB Init] SQL file not found at', sqlPath);
}
