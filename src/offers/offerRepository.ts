import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { offers, restaurants, userOfferStates } from '../db/schema.js';
import type { Offer, Provider } from '../domain/types.js';

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

export async function findUserOfferQuantity(userId: number, provider: Provider, externalId: string): Promise<number> {
  const rows = await db
    .select({ currentQuantity: userOfferStates.currentQuantity })
    .from(userOfferStates)
    .innerJoin(offers, eq(userOfferStates.offerId, offers.id))
    .where(and(eq(userOfferStates.userId, userId), eq(offers.provider, provider), eq(offers.externalId, externalId)))
    .limit(1);

  return rows[0]?.currentQuantity ?? 0;
}

export async function upsertOffer(input: Offer, restaurantId: number): Promise<number> {
  const now = new Date().toISOString();
  await db
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
    });

  const row = await db.query.offers.findFirst({ where: and(eq(offers.provider, input.provider), eq(offers.externalId, input.externalId)) });
  if (!row) {
    throw new Error(`Offer not found after upsert: ${input.provider}:${input.externalId}`);
  }

  return row.id;
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
