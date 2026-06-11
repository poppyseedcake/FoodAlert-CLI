import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { appSettings, userFavoriteRestaurants, userIgnoredRestaurants, userOfferStates, users } from '../db/schema.js';
import { DEFAULT_WATCH_INTERVAL_MINUTES, MIN_WATCH_INTERVAL_MINUTES } from '../domain/constants.js';
import type { UserProfile } from '../domain/types.js';

type UserRow = typeof users.$inferSelect;

function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    foodsiEmail: row.foodsiEmail,
    foodsiPassword: row.foodsiPassword,
    notifyOnlyFavorites: row.notifyOnlyFavorites,
    watchIntervalMinutes: row.watchIntervalMinutes,
    telegramEnabled: row.telegramEnabled,
    telegramChatId: row.telegramChatId,
    telegramPairingCode: row.telegramPairingCode,
    consoleNotificationsEnabled: row.consoleNotificationsEnabled,
  };
}

function assertValidInterval(minutes: number | null): void {
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < MIN_WATCH_INTERVAL_MINUTES)) {
    throw new Error(`Watch interval must be an integer >= ${MIN_WATCH_INTERVAL_MINUTES} or null, got ${minutes}`);
  }
}

export async function listUsers(): Promise<UserProfile[]> {
  const db = getDb();
  const rows = await db.select().from(users).orderBy(users.name);
  return rows.map(toUserProfile);
}

export async function getUser(userId: number): Promise<UserProfile | null> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  return row ? toUserProfile(row) : null;
}

export async function createUser(input: Omit<UserProfile, 'id'>): Promise<UserProfile> {
  assertValidInterval(input.watchIntervalMinutes);
  const db = getDb();
  const now = new Date().toISOString();
  const result = await db
    .insert(users)
    .values({
      name: input.name,
      foodsiEmail: input.foodsiEmail,
      foodsiPassword: input.foodsiPassword,
      notifyOnlyFavorites: input.notifyOnlyFavorites,
      watchIntervalMinutes: input.watchIntervalMinutes,
      telegramEnabled: input.telegramEnabled ?? false,
      telegramChatId: input.telegramChatId ?? null,
      telegramPairingCode: input.telegramPairingCode ?? null,
      consoleNotificationsEnabled: input.consoleNotificationsEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toUserProfile(result[0]);
}

export async function deleteUser(userId: number): Promise<void> {
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(userOfferStates).where(eq(userOfferStates.userId, userId)).run();
    tx.delete(userFavoriteRestaurants).where(eq(userFavoriteRestaurants.userId, userId)).run();
    tx.delete(userIgnoredRestaurants).where(eq(userIgnoredRestaurants.userId, userId)).run();
    tx.delete(users).where(eq(users.id, userId)).run();
  });
}

export async function setNotifyOnlyFavorites(userId: number, enabled: boolean): Promise<void> {
  const db = getDb();
  await db.update(users).set({ notifyOnlyFavorites: enabled, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function setConsoleNotificationsEnabled(userId: number, enabled: boolean): Promise<void> {
  const db = getDb();
  await db.update(users).set({ consoleNotificationsEnabled: enabled, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function setTelegramEnabled(userId: number, enabled: boolean): Promise<void> {
  const db = getDb();
  await db.update(users).set({ telegramEnabled: enabled, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function setTelegramChatId(userId: number, chatId: string | null): Promise<void> {
  const db = getDb();
  await db.update(users).set({ telegramChatId: chatId, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function setTelegramPairingCode(userId: number, code: string | null): Promise<void> {
  const db = getDb();
  await db.update(users).set({ telegramPairingCode: code, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function findUserByTelegramPairingCode(code: string): Promise<UserProfile | null> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.telegramPairingCode, code)).limit(1);
  const row = rows[0];
  return row ? toUserProfile(row) : null;
}

export async function setUserWatchInterval(userId: number, minutes: number | null): Promise<void> {
  assertValidInterval(minutes);
  const db = getDb();
  await db.update(users).set({ watchIntervalMinutes: minutes, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function getDefaultWatchIntervalMinutes(): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  return rows[0]?.defaultWatchIntervalMinutes ?? DEFAULT_WATCH_INTERVAL_MINUTES;
}

export async function setDefaultWatchIntervalMinutes(minutes: number): Promise<void> {
  assertValidInterval(minutes);
  const db = getDb();
  await db
    .insert(appSettings)
    .values({ id: 1, defaultWatchIntervalMinutes: minutes })
    .onConflictDoUpdate({ target: appSettings.id, set: { defaultWatchIntervalMinutes: minutes } });
}
