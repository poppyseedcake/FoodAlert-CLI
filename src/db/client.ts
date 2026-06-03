import Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { DEFAULT_WATCH_INTERVAL_MINUTES } from '../domain/constants.js';
import * as schema from './schema.js';
import { appSettings } from './schema.js';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export type DatabaseSessionOptions = {
  path?: string;
};

export type DatabaseSession = {
  path: string;
  sqlite: Database.Database;
  db: AppDatabase;
  close(): void;
};

const migrationsFolder = './drizzle';

let activeSession: DatabaseSession | null = null;

function defaultDatabasePath(): string {
  return process.env.FOODALERT_DB_PATH ?? 'foodalert.sqlite';
}

function createSession(path: string): DatabaseSession {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  const session: DatabaseSession = {
    path,
    sqlite,
    db,
    close() {
      if (sqlite.open) {
        sqlite.close();
      }
      if (activeSession === session) {
        activeSession = null;
      }
    },
  };

  return session;
}

async function initializeSession(session: DatabaseSession): Promise<void> {
  migrate(session.db, { migrationsFolder });

  await session.db
    .insert(appSettings)
    .values({ id: 1, defaultWatchIntervalMinutes: DEFAULT_WATCH_INTERVAL_MINUTES })
    .onConflictDoNothing();
}

export async function openDatabaseSession(options: DatabaseSessionOptions = {}): Promise<DatabaseSession> {
  const path = options.path ?? defaultDatabasePath();

  if (activeSession) {
    if (activeSession.path === path && activeSession.sqlite.open) {
      return activeSession;
    }
    activeSession.close();
  }

  const session = createSession(path);
  activeSession = session;

  try {
    await initializeSession(session);
    return session;
  } catch (error) {
    session.close();
    throw error;
  }
}

export async function initializeDatabase(): Promise<void> {
  await openDatabaseSession();
}

export function getDb(): AppDatabase {
  if (!activeSession?.sqlite.open) {
    throw new Error('Database session is not open. Call openDatabaseSession() before using repositories.');
  }
  return activeSession.db;
}

export function closeDatabase(): void {
  activeSession?.close();
}
