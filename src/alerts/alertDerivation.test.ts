import { describe, expect, it } from 'vitest';
import { deriveAlertEvents } from './alertDerivation.js';
import type { OfferInput } from '../domain/types.js';
import type { OfferSnapshotChangeSet } from '../offers/offerSnapshot.js';

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

function derive(
  changeSet: OfferSnapshotChangeSet,
  policy: {
    notifyOnlyFavorites?: boolean;
    notifyReStocked?: boolean;
    notifyStockChange?: boolean;
    notifySoldOut?: boolean;
    favoriteRestaurantIds?: number[];
    ignoredRestaurantIds?: number[];
  } = {},
) {
  return deriveAlertEvents(changeSet, {
    notifyOnlyFavorites: policy.notifyOnlyFavorites ?? false,
    notifyReStocked: policy.notifyReStocked ?? true,
    notifyStockChange: policy.notifyStockChange ?? true,
    notifySoldOut: policy.notifySoldOut ?? true,
    favoriteRestaurantIds: new Set(policy.favoriteRestaurantIds ?? []),
    ignoredRestaurantIds: new Set(policy.ignoredRestaurantIds ?? []),
  });
}

describe('deriveAlertEvents', () => {
  it('returns no event when a current offer quantity did not change', () => {
    expect(
      derive({
        currentOffers: [
          {
            offer: makeOffer({ quantity: 5 }),
            restaurantId: 1,
            previousQuantity: 5,
            offerExistedBefore: true,
          },
        ],
        disappearedOffers: [],
      }),
    ).toEqual([]);
  });

  it('returns current-offer alert events from snapshot change facts', () => {
    const newOffer = makeOffer({ externalId: 'new', quantity: 3 });
    const restocked = makeOffer({ externalId: 'restocked', quantity: 2 });
    const soldOut = makeOffer({ externalId: 'sold-out', quantity: 0 });
    const stockChange = makeOffer({ externalId: 'stock-change', quantity: 3 });

    expect(
      derive({
        currentOffers: [
          { offer: newOffer, restaurantId: 1, previousQuantity: 0, offerExistedBefore: false },
          { offer: restocked, restaurantId: 1, previousQuantity: 0, offerExistedBefore: true },
          { offer: soldOut, restaurantId: 1, previousQuantity: 4, offerExistedBefore: true },
          { offer: stockChange, restaurantId: 1, previousQuantity: 7, offerExistedBefore: true },
        ],
        disappearedOffers: [],
      }),
    ).toEqual([
      { type: 'new-offer', offer: newOffer, previousQuantity: 0, currentQuantity: 3 },
      { type: 're-stocked', offer: restocked, previousQuantity: 0, currentQuantity: 2 },
      { type: 'sold-out', offer: soldOut, previousQuantity: 4, currentQuantity: 0 },
      { type: 'stock-change', offer: stockChange, previousQuantity: 7, currentQuantity: 3 },
    ]);
  });

  it('returns sold-out alert events for disappeared offers', () => {
    const disappeared = makeOffer({ externalId: 'gone', quantity: 0 });

    expect(
      derive({
        currentOffers: [],
        disappearedOffers: [{ offer: disappeared, restaurantId: 1, previousQuantity: 4 }],
      }),
    ).toEqual([{ type: 'sold-out', offer: disappeared, previousQuantity: 4, currentQuantity: 0 }]);
  });

  it('does not return alert events for ignored restaurants', () => {
    expect(
      derive(
        {
          currentOffers: [
            { offer: makeOffer({ quantity: 3 }), restaurantId: 1, previousQuantity: 0, offerExistedBefore: false },
          ],
          disappearedOffers: [],
        },
        { ignoredRestaurantIds: [1] },
      ),
    ).toEqual([]);
  });

  it('returns only favorite restaurant alert events when favorite-only notifications are enabled', () => {
    const favoriteOffer = makeOffer({ externalId: 'favorite', quantity: 3 });

    expect(
      derive(
        {
          currentOffers: [
            { offer: favoriteOffer, restaurantId: 1, previousQuantity: 0, offerExistedBefore: false },
            {
              offer: makeOffer({ externalId: 'not-favorite', quantity: 4 }),
              restaurantId: 2,
              previousQuantity: 0,
              offerExistedBefore: false,
            },
          ],
          disappearedOffers: [],
        },
        { notifyOnlyFavorites: true, favoriteRestaurantIds: [1] },
      ),
    ).toEqual([{ type: 'new-offer', offer: favoriteOffer, previousQuantity: 0, currentQuantity: 3 }]);
  });

  it('keeps new offers eligible when re-stocked alerts are disabled', () => {
    const newOffer = makeOffer({ externalId: 'new', quantity: 3 });

    expect(
      derive(
        {
          currentOffers: [
            { offer: newOffer, restaurantId: 1, previousQuantity: 0, offerExistedBefore: false },
            {
              offer: makeOffer({ externalId: 'restocked', quantity: 2 }),
              restaurantId: 1,
              previousQuantity: 0,
              offerExistedBefore: true,
            },
          ],
          disappearedOffers: [],
        },
        { notifyReStocked: false },
      ),
    ).toEqual([{ type: 'new-offer', offer: newOffer, previousQuantity: 0, currentQuantity: 3 }]);
  });

  it('suppresses positive quantity increases and decreases when stock-change alerts are disabled', () => {
    expect(
      derive(
        {
          currentOffers: [
            {
              offer: makeOffer({ externalId: 'increase', quantity: 5 }),
              restaurantId: 1,
              previousQuantity: 2,
              offerExistedBefore: true,
            },
            {
              offer: makeOffer({ externalId: 'decrease', quantity: 2 }),
              restaurantId: 1,
              previousQuantity: 5,
              offerExistedBefore: true,
            },
          ],
          disappearedOffers: [],
        },
        { notifyStockChange: false },
      ),
    ).toEqual([]);
  });

  it('suppresses explicit and disappeared sold-out offers when sold-out alerts are disabled', () => {
    expect(
      derive(
        {
          currentOffers: [
            {
              offer: makeOffer({ externalId: 'explicit', quantity: 0 }),
              restaurantId: 1,
              previousQuantity: 2,
              offerExistedBefore: true,
            },
          ],
          disappearedOffers: [
            {
              offer: makeOffer({ externalId: 'disappeared', quantity: 0 }),
              restaurantId: 1,
              previousQuantity: 3,
            },
          ],
        },
        { notifySoldOut: false },
      ),
    ).toEqual([]);
  });
});
