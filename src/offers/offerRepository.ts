import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { offers, restaurants, userOfferStates } from '../db/schema.js';
import type { Offer, OfferInput, Provider } from '../domain/types.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

type DbOrTx = BetterSQLite3Database<typeof schema>;

type OfferRow = typeof offers.$inferSelect;

export function toOffer(row: OfferRow, restaurantExternalId: string, restaurantName: string, restaurantLogoUrl: string | null, restaurantAddress: string | null): Offer {
  return {
    id: row.id,
    provider: row.provider as Provider,
    externalId: row.externalId,
    restaurantExternalId,
    restaurantName,
    restaurantLogoUrl,
    restaurantAddress,
    name: row.name,
    description: row.description,
    quantity: row.currentQuantity,
    unitPrice: row.unitPrice,
    originalPrice: row.originalPrice,
    pickupFrom: row.pickupFrom ? new Date(row.pickupFrom) : null,
    pickupTo: row.pickupTo ? new Date(row.pickupTo) : null,
    distanceKm: row.distanceKm,
  };
}

export function offerQuantityKey(offer: Pick<OfferInput, 'provider' | 'externalId'>): string {
  return `${offer.provider}:${offer.externalId}`;
}

export async function findUserOfferQuantities(userId: number, offerRefs: Pick<OfferInput, 'provider' | 'externalId'>[]): Promise<Map<string, { quantity: number; existed: boolean }>> {
  if (offerRefs.length === 0) return new Map();

  const externalIdsByProvider = new Map<Provider, Set<string>>();
  for (const offer of offerRefs) {
    const ids = externalIdsByProvider.get(offer.provider) ?? new Set<string>();
    ids.add(offer.externalId);
    externalIdsByProvider.set(offer.provider, ids);
  }

  const rows = await Promise.all(
    Array.from(externalIdsByProvider.entries()).map(([provider, externalIds]) =>
      db
        .select({
          provider: offers.provider,
          externalId: offers.externalId,
          currentQuantity: userOfferStates.currentQuantity,
        })
        .from(userOfferStates)
        .innerJoin(offers, eq(userOfferStates.offerId, offers.id))
        .where(and(eq(userOfferStates.userId, userId), eq(offers.provider, provider), inArray(offers.externalId, Array.from(externalIds)))),
    ),
  );

  return new Map(rows.flat().map((row) => [`${row.provider}:${row.externalId}`, { quantity: row.currentQuantity, existed: true }]));
}

export type UserOfferStateRow = {
  offerId: number;
  provider: Provider;
  externalId: string;
  currentQuantity: number;
};

export async function listUserOfferStates(userId: number): Promise<UserOfferStateRow[]> {
  const rows = await db
    .select({
      offerId: userOfferStates.offerId,
      provider: offers.provider,
      externalId: offers.externalId,
      currentQuantity: userOfferStates.currentQuantity,
    })
    .from(userOfferStates)
    .innerJoin(offers, eq(userOfferStates.offerId, offers.id))
    .where(eq(userOfferStates.userId, userId));

  return rows.map((row) => ({
    offerId: row.offerId,
    provider: row.provider as Provider,
    externalId: row.externalId,
    currentQuantity: row.currentQuantity,
  }));
}

export type OfferWithRestaurant = OfferInput & { offerId: number; restaurantId: number };

export async function getOffersDetailsByIds(offerIds: number[]): Promise<OfferWithRestaurant[]> {
  if (offerIds.length === 0) return [];

  const rows = await db
    .select({
      offer: offers,
      restaurant: restaurants,
    })
    .from(offers)
    .innerJoin(restaurants, eq(offers.restaurantId, restaurants.id))
    .where(inArray(offers.id, offerIds));

  return rows.map((row) => ({
    offerId: row.offer.id,
    restaurantId: row.restaurant.id,
    provider: row.offer.provider as Provider,
    externalId: row.offer.externalId,
    restaurantExternalId: row.restaurant.externalId,
    restaurantName: row.restaurant.name,
    restaurantLogoUrl: row.restaurant.logoUrl,
    restaurantAddress: row.restaurant.address,
    name: row.offer.name,
    description: row.offer.description,
    quantity: row.offer.currentQuantity,
    unitPrice: row.offer.unitPrice,
    originalPrice: row.offer.originalPrice,
    pickupFrom: row.offer.pickupFrom ? new Date(row.offer.pickupFrom) : null,
    pickupTo: row.offer.pickupTo ? new Date(row.offer.pickupTo) : null,
    distanceKm: row.offer.distanceKm,
  }));
}

export async function deleteUserOfferStates(userId: number, offerIds: number[]): Promise<void> {
  if (offerIds.length === 0) return;
  await db
    .delete(userOfferStates)
    .where(and(eq(userOfferStates.userId, userId), inArray(userOfferStates.offerId, offerIds)));
}

export async function upsertOffer(input: OfferInput, restaurantId: number): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .insert(offers)
    .values({
      provider: input.provider,
      externalId: input.externalId,
      restaurantId,
      name: input.name,
      description: input.description,
      currentQuantity: input.quantity,
      unitPrice: input.unitPrice,
      originalPrice: input.originalPrice,
      pickupFrom: input.pickupFrom?.toISOString() ?? null,
      pickupTo: input.pickupTo?.toISOString() ?? null,
      distanceKm: input.distanceKm,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [offers.provider, offers.externalId],
      set: {
        restaurantId,
        name: input.name,
        description: input.description,
        currentQuantity: input.quantity,
        unitPrice: input.unitPrice,
        originalPrice: input.originalPrice,
        pickupFrom: input.pickupFrom?.toISOString() ?? null,
        pickupTo: input.pickupTo?.toISOString() ?? null,
        distanceKm: input.distanceKm,
        lastSeenAt: now,
        updatedAt: now,
      },
    })
    .returning({ id: offers.id });

  const id = result[0]?.id;
  if (!id) {
    throw new Error(`Offer not found after upsert: ${input.provider}:${input.externalId}`);
  }

  return id;
}

export async function upsertUserOfferState(userId: number, offerId: number, currentQuantity: number): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(userOfferStates)
    .values({ userId, offerId, currentQuantity, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [userOfferStates.userId, userOfferStates.offerId],
      set: { currentQuantity, lastSeenAt: now },
    });
}

export function upsertOffersBatch(
  executor: DbOrTx,
  inputs: Array<{ offer: OfferInput; restaurantId: number }>,
): Map<string, number> {
  const result = new Map<string, number>();
  if (inputs.length === 0) return result;

  const now = new Date().toISOString();
  const rows = executor
    .insert(offers)
    .values(
      inputs.map(({ offer, restaurantId }) => ({
        provider: offer.provider,
        externalId: offer.externalId,
        restaurantId,
        name: offer.name,
        description: offer.description,
        currentQuantity: offer.quantity,
        unitPrice: offer.unitPrice,
        originalPrice: offer.originalPrice,
        pickupFrom: offer.pickupFrom?.toISOString() ?? null,
        pickupTo: offer.pickupTo?.toISOString() ?? null,
        distanceKm: offer.distanceKm,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [offers.provider, offers.externalId],
      set: {
        restaurantId: sql.raw(`excluded.${offers.restaurantId.name}`),
        name: sql.raw(`excluded.${offers.name.name}`),
        description: sql.raw(`excluded.${offers.description.name}`),
        currentQuantity: sql.raw(`excluded.${offers.currentQuantity.name}`),
        unitPrice: sql.raw(`excluded.${offers.unitPrice.name}`),
        originalPrice: sql.raw(`excluded.${offers.originalPrice.name}`),
        pickupFrom: sql.raw(`excluded.${offers.pickupFrom.name}`),
        pickupTo: sql.raw(`excluded.${offers.pickupTo.name}`),
        distanceKm: sql.raw(`excluded.${offers.distanceKm.name}`),
        lastSeenAt: now,
        updatedAt: now,
      },
    })
    .returning({ provider: offers.provider, externalId: offers.externalId, id: offers.id })
    .all();

  for (const row of rows) {
    result.set(`${row.provider}:${row.externalId}`, row.id);
  }
  return result;
}

export function upsertUserOfferStatesBatch(
  executor: DbOrTx,
  entries: Array<{ userId: number; offerId: number; currentQuantity: number }>,
): void {
  if (entries.length === 0) return;
  const now = new Date().toISOString();
  executor
    .insert(userOfferStates)
    .values(entries.map((e) => ({ ...e, lastSeenAt: now })))
    .onConflictDoUpdate({
      target: [userOfferStates.userId, userOfferStates.offerId],
      set: { currentQuantity: sql.raw(`excluded.${userOfferStates.currentQuantity.name}`), lastSeenAt: now },
    })
    .run();
}

export async function clearCurrentOffersForUser(userId: number): Promise<void> {
  await db.delete(userOfferStates).where(eq(userOfferStates.userId, userId));
}

export async function listCurrentOffersForUser(userId: number): Promise<Offer[]> {
  const rows = await db
    .select({
      offer: offers,
      quantity: userOfferStates.currentQuantity,
      restaurantExternalId: restaurants.externalId,
      restaurantName: restaurants.name,
      restaurantLogoUrl: restaurants.logoUrl,
      restaurantAddress: restaurants.address,
    })
    .from(userOfferStates)
    .innerJoin(offers, eq(userOfferStates.offerId, offers.id))
    .innerJoin(restaurants, eq(offers.restaurantId, restaurants.id))
    .where(and(eq(userOfferStates.userId, userId), gt(userOfferStates.currentQuantity, 0)))
    .orderBy(restaurants.name, offers.name);

  return rows.map((row) => ({
    ...toOffer(row.offer, row.restaurantExternalId, row.restaurantName, row.restaurantLogoUrl, row.restaurantAddress),
    quantity: row.quantity,
  }));
}
