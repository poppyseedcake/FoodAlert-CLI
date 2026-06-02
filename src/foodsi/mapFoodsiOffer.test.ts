import { describe, expect, it } from 'vitest';
import { mapFoodsiOffer } from './mapFoodsiOffer.js';
import type { FoodsiApiItem } from './foodsiTypes.js';

function makeItem(overrides: Partial<FoodsiApiItem['attributes']> = {}): FoodsiApiItem {
  return {
    id: 'offer-1',
    attributes: {
      current_quantity: 3,
      name: 'Mystery bag',
      unit_price: '9.99',
      original_price: 19.99,
      venue_id: 42,
      venue_name: 'Pizza Hut',
      venue_address: 'Marszałkowska 1',
      ...overrides,
    },
  };
}

describe('mapFoodsiOffer', () => {
  it('maps a full offer correctly', () => {
    const result = mapFoodsiOffer(makeItem());
    expect(result).toEqual({
      provider: 'foodsi',
      externalId: 'offer-1',
      restaurantExternalId: '42',
      restaurantName: 'Pizza Hut',
      restaurantLogoUrl: null,
      restaurantAddress: 'Marszałkowska 1',
      name: 'Mystery bag',
      description: null,
      quantity: 3,
      unitPrice: 9.99,
      originalPrice: 19.99,
      pickupFrom: null,
      pickupTo: null,
      distanceKm: null,
    });
  });

  it('parses prices with comma as decimal separator', () => {
    const result = mapFoodsiOffer(makeItem({ unit_price: '12,50' }));
    expect(result?.unitPrice).toBe(12.5);
  });

  it('returns null when both venue_id and venue_name are missing', () => {
    const result = mapFoodsiOffer(makeItem({ venue_id: undefined, venue_name: undefined }));
    expect(result).toBeNull();
  });

  it('uses composite key name|address when venue_id is missing', () => {
    const result = mapFoodsiOffer(
      makeItem({ venue_id: undefined, venue_name: 'Pizza Hut', venue_address: 'Marszałkowska 1' }),
    );
    expect(result?.restaurantExternalId).toBe('Pizza Hut|Marszałkowska 1');
  });

  it('falls back to name|address with empty address when only venue_id is missing', () => {
    const result = mapFoodsiOffer(
      makeItem({ venue_id: undefined, venue_name: 'Pizza Hut', venue_address: undefined }),
    );
    expect(result?.restaurantExternalId).toBe('Pizza Hut|');
  });

  it('uses fallback name "Unknown restaurant" when venue_name is also missing but venue_id is present', () => {
    const result = mapFoodsiOffer(makeItem({ venue_id: 99, venue_name: undefined }));
    expect(result?.restaurantName).toBe('Unknown restaurant');
    expect(result?.restaurantExternalId).toBe('99');
  });

  it('defaults quantity to 0 when current_quantity is missing', () => {
    const result = mapFoodsiOffer(makeItem({ current_quantity: undefined }));
    expect(result?.quantity).toBe(0);
  });

  it('returns null for non-finite price strings', () => {
    const result = mapFoodsiOffer(makeItem({ unit_price: 'abc' }));
    expect(result?.unitPrice).toBeNull();
  });

  it('parses distance as number when string', () => {
    const result = mapFoodsiOffer(makeItem({ distance: '1,5' }));
    expect(result?.distanceKm).toBe(1.5);
  });

  it('parses pickup_from and pickup_to as Date', () => {
    const result = mapFoodsiOffer(
      makeItem({ pickup_from: '2025-01-15T10:00:00Z', pickup_to: '2025-01-15T12:00:00Z' }),
    );
    expect(result?.pickupFrom).toBeInstanceOf(Date);
    expect(result?.pickupTo).toBeInstanceOf(Date);
  });
});
