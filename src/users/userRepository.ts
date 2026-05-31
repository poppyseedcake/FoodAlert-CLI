import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { appSettings, users } from '../db/schema.js';
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

export async function listUsers(): Promise<UserProfile[]> {
  const rows = await db.select().from(users).orderBy(users.name);
  return rows.map(toUserProfile);
}

export async function getUser(userId: number): Promise<UserProfile | null> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return row ? toUserProfile(row) : null;
}

export async function createUser(input: Omit<UserProfile, 'id'>): Promise<UserProfile> {
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

export async function setNotifyOnlyFavorites(userId: number, enabled: boolean): Promise<void> {
  await db.update(users).set({ notifyOnlyFavorites: enabled, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function setUserWatchInterval(userId: number, minutes: number | null): Promise<void> {
  await db.update(users).set({ watchIntervalMinutes: minutes, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function getDefaultWatchIntervalMinutes(): Promise<number> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  return row?.defaultWatchIntervalMinutes ?? 5;
}

export async function setDefaultWatchIntervalMinutes(minutes: number): Promise<void> {
  await db
    .insert(appSettings)
    .values({ id: 1, defaultWatchIntervalMinutes: minutes })
    .onConflictDoUpdate({ target: appSettings.id, set: { defaultWatchIntervalMinutes: minutes } });
}
