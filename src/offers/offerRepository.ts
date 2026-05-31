import { and, eq, gt, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { offers, restaurants, userOfferStates } from '../db/schema.js';
import type { Offer, OfferInput, Provider } from '../domain/types.js';

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

export function offerQuantityKey(offer: Pick<OfferInput, 'provider' | 'externalId'>): string {
  return `${offer.provider}:${offer.externalId}`;
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
