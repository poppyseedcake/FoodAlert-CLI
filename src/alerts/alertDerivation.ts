import type { OfferSnapshotChangeSet } from '../offers/offerSnapshot.js';
import type { AlertEvent, OfferInput, UserProfile } from '../domain/types.js';
import { listFavoriteRestaurantIds, listIgnoredRestaurantIds } from '../restaurants/restaurantRepository.js';

export type RestaurantNotificationPolicy = {
  notifyOnlyFavorites: boolean;
  favoriteRestaurantIds: Set<number>;
  ignoredRestaurantIds: Set<number>;
};

function eventForCurrentOffer(
  offer: OfferInput,
  previousQuantity: number,
  offerExistedBefore: boolean,
): AlertEvent | null {
  const currentQuantity = offer.quantity;

  if (currentQuantity === previousQuantity) {
    return null;
  }

  if (previousQuantity === 0 && currentQuantity > 0) {
    return { type: offerExistedBefore ? 're-stocked' : 'new-offer', offer, previousQuantity, currentQuantity };
  }

  if (previousQuantity > 0 && currentQuantity === 0) {
    return { type: 'sold-out', offer, previousQuantity, currentQuantity };
  }

  return { type: 'stock-change', offer, previousQuantity, currentQuantity };
}

function eventForDisappearedOffer(input: {
  offer: OfferInput;
  previousQuantity: number;
}): AlertEvent {
  return {
    type: 'sold-out',
    offer: input.offer,
    previousQuantity: input.previousQuantity,
    currentQuantity: 0,
  };
}

function shouldNotifyAboutRestaurant(restaurantId: number, policy: RestaurantNotificationPolicy): boolean {
  if (policy.ignoredRestaurantIds.has(restaurantId)) {
    return false;
  }

  if (policy.notifyOnlyFavorites) {
    return policy.favoriteRestaurantIds.has(restaurantId);
  }

  return true;
}

export function deriveAlertEvents(
  changeSet: OfferSnapshotChangeSet,
  restaurantPolicy: RestaurantNotificationPolicy,
): AlertEvent[] {
  const events: AlertEvent[] = [];

  for (const current of changeSet.currentOffers) {
    if (!shouldNotifyAboutRestaurant(current.restaurantId, restaurantPolicy)) continue;

    const event = eventForCurrentOffer(current.offer, current.previousQuantity, current.offerExistedBefore);
    if (event) {
      events.push(event);
    }
  }

  for (const disappeared of changeSet.disappearedOffers) {
    if (!shouldNotifyAboutRestaurant(disappeared.restaurantId, restaurantPolicy)) continue;

    events.push(eventForDisappearedOffer(disappeared));
  }

  return events;
}

export async function deriveAlertEventsForUser(
  user: Pick<UserProfile, 'id' | 'notifyOnlyFavorites'>,
  changeSet: OfferSnapshotChangeSet,
): Promise<AlertEvent[]> {
  const [favoriteRestaurantIds, ignoredRestaurantIds] = await Promise.all([
    listFavoriteRestaurantIds(user.id),
    listIgnoredRestaurantIds(user.id),
  ]);

  return deriveAlertEvents(changeSet, {
    notifyOnlyFavorites: user.notifyOnlyFavorites,
    favoriteRestaurantIds: new Set(favoriteRestaurantIds),
    ignoredRestaurantIds: new Set(ignoredRestaurantIds),
  });
}
