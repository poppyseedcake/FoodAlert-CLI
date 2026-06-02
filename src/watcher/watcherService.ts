import { diffOffer, shouldNotifyAboutRestaurant } from '../alerts/diffOffers.js';
import type { OfferInput, UserDisplay, UserProfile } from '../domain/types.js';
import { FoodsiClient } from '../foodsi/foodsiClient.js';
import {
  deleteUserOfferStates,
  findUserOfferQuantities,
  getOffersDetailsByIds,
  listUserOfferStates,
  offerQuantityKey,
  upsertOffersBatch,
  upsertUserOfferStatesBatch,
} from '../offers/offerRepository.js';
import { ConsoleNotifier } from '../notifications/consoleNotifier.js';
import {
  listFavoriteRestaurantIds,
  listIgnoredRestaurantIds,
  restaurantFromOffer,
  upsertRestaurantsBatch,
} from '../restaurants/restaurantRepository.js';
import { db } from '../db/client.js';

function toDisplay(user: UserProfile): UserDisplay {
  return { id: user.id, name: user.name };
}

export class WatcherService {
  constructor(
    private readonly foodsiClient = new FoodsiClient(),
    private readonly notifier = new ConsoleNotifier(),
  ) {}

  async runOnce(user: UserProfile): Promise<void> {
    const display = toDisplay(user);
    const favoriteRestaurantIds = new Set(await listFavoriteRestaurantIds(user.id));
    const ignoredRestaurantIds = new Set(await listIgnoredRestaurantIds(user.id));
    const fetchedOffers = await this.foodsiClient.fetchOffers(user);
    const previousQuantities = await findUserOfferQuantities(user.id, fetchedOffers);

    this.notifier.info(display, `Fetched ${fetchedOffers.length} offers.`);

    const restaurantIdByKey = new Map<string, number>();

    db.transaction((tx) => {
      const uniqueRestaurants = new Map<string, ReturnType<typeof restaurantFromOffer>>();
      for (const offer of fetchedOffers) {
        const restaurantInput = restaurantFromOffer(offer);
        const key = `${restaurantInput.provider}:${restaurantInput.externalId}`;
        if (!uniqueRestaurants.has(key)) {
          uniqueRestaurants.set(key, restaurantInput);
        }
      }

      const restaurantIdMap = upsertRestaurantsBatch(tx, Array.from(uniqueRestaurants.values()));
      for (const [key, id] of restaurantIdMap) {
        restaurantIdByKey.set(key, id);
      }

      const offerInserts: Array<{ offer: OfferInput; restaurantId: number }> = [];
      for (const offer of fetchedOffers) {
        const restaurantId = restaurantIdByKey.get(`${offer.provider}:${offer.restaurantExternalId}`);
        if (restaurantId === undefined) {
          this.notifier.error(display, new Error(`Missing restaurantId for offer ${offerQuantityKey(offer)}`));
          continue;
        }
        offerInserts.push({ offer, restaurantId });
      }

      const offerIdMap = upsertOffersBatch(tx, offerInserts);

      const stateEntries: Array<{ userId: number; offerId: number; currentQuantity: number }> = [];
      for (const { offer } of offerInserts) {
        const offerId = offerIdMap.get(offerQuantityKey(offer));
        if (offerId === undefined) continue;
        stateEntries.push({ userId: user.id, offerId, currentQuantity: offer.quantity });
      }
      upsertUserOfferStatesBatch(tx, stateEntries);
    });

    for (const offer of fetchedOffers) {
      const restaurantId = restaurantIdByKey.get(`${offer.provider}:${offer.restaurantExternalId}`) ?? 0;
      const previousState = previousQuantities.get(offerQuantityKey(offer));
      const previousQuantity = previousState?.quantity ?? 0;
      const offerExistedBefore = previousState?.existed ?? false;

      const event = diffOffer(offer, previousQuantity, offerExistedBefore);
      if (!event) continue;

      if (
        shouldNotifyAboutRestaurant({
          restaurantId,
          notifyOnlyFavorites: user.notifyOnlyFavorites,
          favoriteRestaurantIds,
          ignoredRestaurantIds,
        })
      ) {
        this.notifier.notify(display, event);
      }
    }

    await this.detectSoldOuts(user, display, fetchedOffers, favoriteRestaurantIds, ignoredRestaurantIds);
  }

  private async detectSoldOuts(
    user: UserProfile,
    display: UserDisplay,
    currentOffers: OfferInput[],
    favoriteRestaurantIds: Set<number>,
    ignoredRestaurantIds: Set<number>,
  ): Promise<void> {
    const currentKeys = new Set(currentOffers.map(offerQuantityKey));
    const previousStates = await listUserOfferStates(user.id);
    const soldOutRefs = previousStates.filter((s) => !currentKeys.has(offerQuantityKey(s)));

    if (soldOutRefs.length === 0) return;

    const details = await getOffersDetailsByIds(soldOutRefs.map((r) => r.offerId));
    const detailByOfferId = new Map(details.map((d) => [d.offerId, d]));

    for (const ref of soldOutRefs) {
      const detail = detailByOfferId.get(ref.offerId);
      if (!detail) {
        await deleteUserOfferStates(user.id, [ref.offerId]);
        continue;
      }

      const soldOutEvent = {
        type: 'sold-out' as const,
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
        previousQuantity: ref.currentQuantity,
        currentQuantity: 0,
      };

      if (
        shouldNotifyAboutRestaurant({
          restaurantId: detail.restaurantId,
          notifyOnlyFavorites: user.notifyOnlyFavorites,
          favoriteRestaurantIds,
          ignoredRestaurantIds,
        })
      ) {
        this.notifier.notify(display, soldOutEvent);
      }
    }

    await deleteUserOfferStates(user.id, soldOutRefs.map((r) => r.offerId));
  }
}
