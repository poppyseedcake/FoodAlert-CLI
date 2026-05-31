import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const sqlite = new Database('foodalert.sqlite');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export function initializeDatabase(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY,
      default_watch_interval_minutes INTEGER NOT NULL DEFAULT 5
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      foodsi_email TEXT NOT NULL,
      foodsi_password TEXT NOT NULL,
      notify_only_favorites INTEGER NOT NULL DEFAULT 0,
      watch_interval_minutes INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      name TEXT NOT NULL,
      logo_url TEXT,
      address TEXT,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, external_id)
    );

    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      name TEXT NOT NULL,
      description TEXT,
      current_quantity INTEGER NOT NULL,
      unit_price REAL,
      original_price REAL,
      pickup_from TEXT,
      pickup_to TEXT,
      distance_km REAL,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, external_id)
    );

    CREATE TABLE IF NOT EXISTS user_favorite_restaurants (
      user_id INTEGER NOT NULL REFERENCES users(id),
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      created_at TEXT NOT NULL,
      UNIQUE(user_id, restaurant_id)
    );

    CREATE TABLE IF NOT EXISTS user_ignored_restaurants (
      user_id INTEGER NOT NULL REFERENCES users(id),
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      created_at TEXT NOT NULL,
      UNIQUE(user_id, restaurant_id)
    );

    CREATE TABLE IF NOT EXISTS user_offer_states (
      user_id INTEGER NOT NULL REFERENCES users(id),
      offer_id INTEGER NOT NULL REFERENCES offers(id),
      current_quantity INTEGER NOT NULL,
      last_seen_at TEXT NOT NULL,
      UNIQUE(user_id, offer_id)
    );
  `);

  sqlite.prepare('INSERT OR IGNORE INTO app_settings (id, default_watch_interval_minutes) VALUES (1, 5)').run();
}
