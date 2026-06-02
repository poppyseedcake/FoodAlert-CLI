import { describe, expect, it } from 'vitest';
import { diffOffer, shouldNotifyAboutRestaurant } from './diffOffers.js';
import type { OfferInput } from '../domain/types.js';

function makeOffer(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    provider: 'foodsi',
    externalId: 'offer-1',
    restaurantExternalId: 'rest-1',
    restaurantName: 'Test',
    restaurantLogoUrl: null,
    restaurantAddress: null,
    name: 'Test offer',
    description: null,
    quantity: 1,
    unitPrice: 10,
    originalPrice: 20,
    pickupFrom: null,
    pickupTo: null,
    distanceKm: null,
    ...overrides,
  };
}

describe('diffOffer', () => {
  it('returns null when quantity did not change', () => {
    expect(diffOffer(makeOffer({ quantity: 5 }), 5, true)).toBeNull();
  });

  it('returns new-offer when offer is new and has stock', () => {
    const offer = makeOffer({ quantity: 3 });
    expect(diffOffer(offer, 0, false)).toEqual({
      type: 'new-offer',
      offer,
      previousQuantity: 0,
      currentQuantity: 3,
    });
  });

  it('returns re-stocked when offer existed before with 0 and now has stock', () => {
    const offer = makeOffer({ quantity: 2 });
    expect(diffOffer(offer, 0, true)).toEqual({
      type: 're-stocked',
      offer,
      previousQuantity: 0,
      currentQuantity: 2,
    });
  });

  it('returns sold-out when quantity drops to 0', () => {
    const offer = makeOffer({ quantity: 0 });
    expect(diffOffer(offer, 4, true)).toEqual({
      type: 'sold-out',
      offer,
      previousQuantity: 4,
      currentQuantity: 0,
    });
  });

  it('returns stock-change for partial quantity changes above zero', () => {
    const offer = makeOffer({ quantity: 3 });
    expect(diffOffer(offer, 7, true)).toEqual({
      type: 'stock-change',
      offer,
      previousQuantity: 7,
      currentQuantity: 3,
    });
  });
});

describe('shouldNotifyAboutRestaurant', () => {
  const baseInput = {
    restaurantId: 1,
    notifyOnlyFavorites: false,
    favoriteRestaurantIds: new Set<number>(),
    ignoredRestaurantIds: new Set<number>(),
  };

  it('returns false for ignored restaurant', () => {
    expect(
      shouldNotifyAboutRestaurant({ ...baseInput, ignoredRestaurantIds: new Set([1]) }),
    ).toBe(false);
  });

  it('returns true when not restricted to favorites and not ignored', () => {
    expect(shouldNotifyAboutRestaurant(baseInput)).toBe(true);
  });

  it('returns true when restricted to favorites and restaurant is favorite', () => {
    expect(
      shouldNotifyAboutRestaurant({
        ...baseInput,
        notifyOnlyFavorites: true,
        favoriteRestaurantIds: new Set([1]),
      }),
    ).toBe(true);
  });

  it('returns false when restricted to favorites and restaurant is not favorite', () => {
    expect(
      shouldNotifyAboutRestaurant({
        ...baseInput,
        notifyOnlyFavorites: true,
        favoriteRestaurantIds: new Set([2]),
      }),
    ).toBe(false);
  });
});
