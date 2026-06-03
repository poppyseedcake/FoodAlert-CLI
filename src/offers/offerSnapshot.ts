import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { userOfferStates } from '../db/schema.js';
import { restaurantIdentityKey, restaurantIdentityKeyFromOffer } from '../domain/providerIdentity.js';
import type { OfferInput } from '../domain/types.js';
import {
  findUserOfferQuantities,
  getOffersDetailsByIds,
  listUserOfferStates,
  offerQuantityKey,
  upsertOffersBatch,
  upsertUserOfferStatesBatch,
} from './offerRepository.js';
import { restaurantFromOffer, upsertRestaurantsBatch } from '../restaurants/restaurantRepository.js';

export type CurrentOfferChangeFact = {
  offer: OfferInput;
  restaurantId: number;
  previousQuantity: number;
  offerExistedBefore: boolean;
};

export type DisappearedOfferChangeFact = {
  offer: OfferInput;
  restaurantId: number;
  previousQuantity: number;
};

export type OfferSnapshotChangeSet = {
  currentOffers: CurrentOfferChangeFact[];
  disappearedOffers: DisappearedOfferChangeFact[];
};

export async function recordOfferSnapshot(userId: number, fetchedOffers: OfferInput[]): Promise<OfferSnapshotChangeSet> {
  const db = getDb();
  const previousQuantities = await findUserOfferQuantities(userId, fetchedOffers);
  const previousStates = await listUserOfferStates(userId);
  const currentKeys = new Set(fetchedOffers.map(offerQuantityKey));
  const disappearedRefs = previousStates.filter((state) => !currentKeys.has(offerQuantityKey(state)));
  const disappearedDetails = await getOffersDetailsByIds(disappearedRefs.map((ref) => ref.offerId));
  const detailByOfferId = new Map(disappearedDetails.map((detail) => [detail.offerId, detail]));

  const disappearedOffers: DisappearedOfferChangeFact[] = [];
  for (const ref of disappearedRefs) {
    const detail = detailByOfferId.get(ref.offerId);
    if (!detail) continue;

    disappearedOffers.push({
      offer: {
        provider: detail.provider,
        externalId: detail.externalId,
        restaurantExternalId: detail.restaurantExternalId,
        restaurantName: detail.restaurantName,
        restaurantLogoUrl: detail.restaurantLogoUrl,
        restaurantAddress: detail.restaurantAddress,
        name: detail.name,
        description: detail.description,
        quantity: 0,
        unitPrice: detail.unitPrice,
        originalPrice: detail.originalPrice,
        pickupFrom: detail.pickupFrom,
        pickupTo: detail.pickupTo,
        distanceKm: detail.distanceKm,
      },
      restaurantId: detail.restaurantId,
      previousQuantity: ref.currentQuantity,
    });
  }

  let currentOffers: CurrentOfferChangeFact[] = [];

  db.transaction((tx) => {
    const uniqueRestaurants = new Map<string, ReturnType<typeof restaurantFromOffer>>();
    for (const offer of fetchedOffers) {
      const restaurantInput = restaurantFromOffer(offer);
      const key = restaurantIdentityKey(restaurantInput);
      if (!uniqueRestaurants.has(key)) {
        uniqueRestaurants.set(key, restaurantInput);
      }
    }

    const restaurantIdByKey = upsertRestaurantsBatch(tx, Array.from(uniqueRestaurants.values()));

    const offerInserts = fetchedOffers.map((offer) => {
      const restaurantId = restaurantIdByKey.get(restaurantIdentityKeyFromOffer(offer));
      if (restaurantId === undefined) {
        throw new Error(`Missing restaurantId for offer ${offerQuantityKey(offer)}`);
      }
      return { offer, restaurantId };
    });

    const offerIdByKey = upsertOffersBatch(tx, offerInserts);
    const stateEntries = offerInserts.map(({ offer }) => {
      const offerId = offerIdByKey.get(offerQuantityKey(offer));
      if (offerId === undefined) {
        throw new Error(`Missing offerId for offer ${offerQuantityKey(offer)}`);
      }
      return { userId, offerId, currentQuantity: offer.quantity };
    });

    upsertUserOfferStatesBatch(tx, stateEntries);

    const disappearedOfferIds = disappearedRefs.map((ref) => ref.offerId);
    if (disappearedOfferIds.length > 0) {
      tx.delete(userOfferStates)
        .where(and(eq(userOfferStates.userId, userId), inArray(userOfferStates.offerId, disappearedOfferIds)))
        .run();
    }

    currentOffers = offerInserts.map(({ offer, restaurantId }) => {
      const previousState = previousQuantities.get(offerQuantityKey(offer));
      return {
        offer,
        restaurantId,
        previousQuantity: previousState?.quantity ?? 0,
        offerExistedBefore: previousState?.existed ?? false,
      };
    });
  });

  return { currentOffers, disappearedOffers };
}
