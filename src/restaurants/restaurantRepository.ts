import { and, eq, gt, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { offers, restaurants, userFavoriteRestaurants, userIgnoredRestaurants, userOfferStates } from '../db/schema.js';
import type { OfferInput, Provider, Restaurant, RestaurantInput } from '../domain/types.js';

type RestaurantRow = typeof restaurants.$inferSelect;

export function toRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    provider: row.provider as Provider,
    externalId: row.externalId,
    name: row.name,
    logoUrl: row.logoUrl,
    address: row.address,
  };
}

export async function upsertRestaurant(input: RestaurantInput): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .insert(restaurants)
    .values({
      provider: input.provider,
      externalId: input.externalId,
      name: input.name,
      logoUrl: input.logoUrl,
      address: input.address,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [restaurants.provider, restaurants.externalId],
      set: {
        name: input.name,
        logoUrl: input.logoUrl,
        address: input.address,
        lastSeenAt: now,
        updatedAt: now,
      },
    })
    .returning({ id: restaurants.id });

  const id = result[0]?.id;
  if (!id) {
    throw new Error(`Restaurant not found after upsert: ${input.provider}:${input.externalId}`);
  }

  return id;
}

export async function listRestaurantsFromCurrentOffers(userId: number): Promise<Restaurant[]> {
  const rows = await db
    .select({ restaurant: restaurants })
    .from(userOfferStates)
    .innerJoin(offers, eq(userOfferStates.offerId, offers.id))
    .innerJoin(restaurants, eq(offers.restaurantId, restaurants.id))
    .where(and(eq(userOfferStates.userId, userId), gt(userOfferStates.currentQuantity, 0)))
    .groupBy(restaurants.id)
    .orderBy(restaurants.name);

  return rows.map((row) => toRestaurant(row.restaurant));
}

export async function listRecentlySeenRestaurants(): Promise<Restaurant[]> {
  const rows = await db.select().from(restaurants).orderBy(restaurants.name);
  return rows.map(toRestaurant);
}

export async function getRestaurantsByIds(ids: number[]): Promise<Restaurant[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(restaurants).where(inArray(restaurants.id, ids)).orderBy(restaurants.name);
  return rows.map(toRestaurant);
}

export async function addFavoriteRestaurant(userId: number, restaurantId: number): Promise<void> {
  await db
    .insert(userFavoriteRestaurants)
    .values({ userId, restaurantId, createdAt: new Date().toISOString() })
    .onConflictDoNothing();
}

export async function addFavoriteRestaurants(userId: number, restaurantIds: number[]): Promise<void> {
  if (restaurantIds.length === 0) return;
  const now = new Date().toISOString();
  await db
    .insert(userFavoriteRestaurants)
    .values(restaurantIds.map((restaurantId) => ({ userId, restaurantId, createdAt: now })))
    .onConflictDoNothing();
}

export async function removeFavoriteRestaurant(userId: number, restaurantId: number): Promise<void> {
  await db
    .delete(userFavoriteRestaurants)
    .where(and(eq(userFavoriteRestaurants.userId, userId), eq(userFavoriteRestaurants.restaurantId, restaurantId)));
}

export async function removeFavoriteRestaurants(userId: number, restaurantIds: number[]): Promise<void> {
  if (restaurantIds.length === 0) return;
  await db
    .delete(userFavoriteRestaurants)
    .where(and(eq(userFavoriteRestaurants.userId, userId), inArray(userFavoriteRestaurants.restaurantId, restaurantIds)));
}

export async function addIgnoredRestaurant(userId: number, restaurantId: number): Promise<void> {
  await db
    .insert(userIgnoredRestaurants)
    .values({ userId, restaurantId, createdAt: new Date().toISOString() })
    .onConflictDoNothing();
}

export async function addIgnoredRestaurants(userId: number, restaurantIds: number[]): Promise<void> {
  if (restaurantIds.length === 0) return;
  const now = new Date().toISOString();
  await db
    .insert(userIgnoredRestaurants)
    .values(restaurantIds.map((restaurantId) => ({ userId, restaurantId, createdAt: now })))
    .onConflictDoNothing();
}

export async function removeIgnoredRestaurant(userId: number, restaurantId: number): Promise<void> {
  await db
    .delete(userIgnoredRestaurants)
    .where(and(eq(userIgnoredRestaurants.userId, userId), eq(userIgnoredRestaurants.restaurantId, restaurantId)));
}

export async function removeIgnoredRestaurants(userId: number, restaurantIds: number[]): Promise<void> {
  if (restaurantIds.length === 0) return;
  await db
    .delete(userIgnoredRestaurants)
    .where(and(eq(userIgnoredRestaurants.userId, userId), inArray(userIgnoredRestaurants.restaurantId, restaurantIds)));
}

export async function listFavoriteRestaurantIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userFavoriteRestaurants).where(eq(userFavoriteRestaurants.userId, userId));
  return rows.map((row) => row.restaurantId);
}

export async function listIgnoredRestaurantIds(userId: number): Promise<number[]> {
  const rows = await db.select().from(userIgnoredRestaurants).where(eq(userIgnoredRestaurants.userId, userId));
  return rows.map((row) => row.restaurantId);
}

export function restaurantFromOffer(offer: OfferInput): RestaurantInput {
  return {
    provider: offer.provider,
    externalId: offer.restaurantExternalId,
    name: offer.restaurantName,
    logoUrl: offer.restaurantLogoUrl,
    address: offer.restaurantAddress,
  };
}
