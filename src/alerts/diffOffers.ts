import type { AlertEvent, Offer } from '../domain/types.js';

export function diffOffer(offer: Offer, previousQuantity: number): AlertEvent | null {
  const currentQuantity = offer.quantity;

  if (currentQuantity === previousQuantity) {
    return null;
  }

  if (previousQuantity === 0 && currentQuantity > 0) {
    return { type: 'new-offer', offer, previousQuantity, currentQuantity };
  }

  if (previousQuantity > 0 && currentQuantity === 0) {
    return { type: 'sold-out', offer, previousQuantity, currentQuantity };
  }

  return { type: 'stock-change', offer, previousQuantity, currentQuantity };
}

export function shouldNotifyAboutRestaurant(input: {
  restaurantId: number;
  notifyOnlyFavorites: boolean;
  favoriteRestaurantIds: Set<number>;
  ignoredRestaurantIds: Set<number>;
}): boolean {
  if (input.ignoredRestaurantIds.has(input.restaurantId)) {
    return false;
  }

  if (input.notifyOnlyFavorites) {
    return input.favoriteRestaurantIds.has(input.restaurantId);
  }

  return true;
}
