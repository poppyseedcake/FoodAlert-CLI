import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { DEFAULT_WATCH_INTERVAL_MINUTES } from '../domain/constants.js';
import * as schema from './schema.js';
import { appSettings } from './schema.js';

const databasePath = process.env.FOODALERT_DB_PATH ?? 'foodalert.sqlite';
const sqlite = new Database(databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

const migrationsFolder = './drizzle';

export async function initializeDatabase(): Promise<void> {
  migrate(db, { migrationsFolder });

  await db
    .insert(appSettings)
    .values({ id: 1, defaultWatchIntervalMinutes: DEFAULT_WATCH_INTERVAL_MINUTES })
    .onConflictDoNothing();
}

export function closeDatabase(): void {
  if (sqlite.open) {
    sqlite.close();
  }
}
