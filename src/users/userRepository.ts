import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
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
  };
}

function assertValidInterval(minutes: number | null): void {
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < MIN_WATCH_INTERVAL_MINUTES)) {
    throw new Error(`Watch interval must be an integer >= ${MIN_WATCH_INTERVAL_MINUTES} or null, got ${minutes}`);
  }
}

export async function listUsers(): Promise<UserProfile[]> {
  const rows = await db.select().from(users).orderBy(users.name);
  return rows.map(toUserProfile);
}

export async function getUser(userId: number): Promise<UserProfile | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  return row ? toUserProfile(row) : null;
}

export async function createUser(input: Omit<UserProfile, 'id'>): Promise<UserProfile> {
  assertValidInterval(input.watchIntervalMinutes);
  const now = new Date().toISOString();
  const result = await db
    .insert(users)
    .values({
      name: input.name,
      foodsiEmail: input.foodsiEmail,
      foodsiPassword: input.foodsiPassword,
      notifyOnlyFavorites: input.notifyOnlyFavorites,
      watchIntervalMinutes: input.watchIntervalMinutes,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toUserProfile(result[0]);
}

export async function deleteUser(userId: number): Promise<void> {
  db.transaction((tx) => {
    tx.delete(userOfferStates).where(eq(userOfferStates.userId, userId)).run();
    tx.delete(userFavoriteRestaurants).where(eq(userFavoriteRestaurants.userId, userId)).run();
    tx.delete(userIgnoredRestaurants).where(eq(userIgnoredRestaurants.userId, userId)).run();
    tx.delete(users).where(eq(users.id, userId)).run();
  });
}

export async function setNotifyOnlyFavorites(userId: number, enabled: boolean): Promise<void> {
  await db.update(users).set({ notifyOnlyFavorites: enabled, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function setUserWatchInterval(userId: number, minutes: number | null): Promise<void> {
  assertValidInterval(minutes);
  await db.update(users).set({ watchIntervalMinutes: minutes, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function getDefaultWatchIntervalMinutes(): Promise<number> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  return rows[0]?.defaultWatchIntervalMinutes ?? DEFAULT_WATCH_INTERVAL_MINUTES;
}

export async function setDefaultWatchIntervalMinutes(minutes: number): Promise<void> {
  assertValidInterval(minutes);
  await db
    .insert(appSettings)
    .values({ id: 1, defaultWatchIntervalMinutes: minutes })
    .onConflictDoUpdate({ target: appSettings.id, set: { defaultWatchIntervalMinutes: minutes } });
}
