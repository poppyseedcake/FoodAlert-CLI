import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import * as schema from './schema.js';
import { appSettings } from './schema.js';

const databasePath = process.env.FOODALERT_DB_PATH ?? 'foodalert.sqlite';
const sqlite = new Database(databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

const migrationsFolder = './drizzle';
const expectedTables = [
  'app_settings',
  'users',
  'restaurants',
  'offers',
  'user_favorite_restaurants',
  'user_ignored_restaurants',
  'user_offer_states',
];

function tableExists(name: string): boolean {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  return Boolean(row);
}

function baselineExistingSchemaIfNeeded(): void {
  if (!tableExists('users') || tableExists('__drizzle_migrations')) {
    return;
  }

  const missingTables = expectedTables.filter((table) => !tableExists(table));
  if (missingTables.length > 0) {
    throw new Error(`Existing database is missing tables: ${missingTables.join(', ')}. Reset foodalert.sqlite or create a proper migration.`);
  }

  const latestMigration = readMigrationFiles({ migrationsFolder }).at(-1);
  if (!latestMigration) {
    return;
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    );
  `);

  sqlite
    .prepare('INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)')
    .run(latestMigration.hash, latestMigration.folderMillis);
}

export async function initializeDatabase(): Promise<void> {
  baselineExistingSchemaIfNeeded();
  migrate(db, { migrationsFolder });

  await db
    .insert(appSettings)
    .values({ id: 1, defaultWatchIntervalMinutes: 5 })
    .onConflictDoNothing();
}
