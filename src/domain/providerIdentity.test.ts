import { describe, expect, it } from 'vitest';
import {
  groupExternalIdsByProvider,
  offerIdentityKey,
  providerIdentityLabel,
  restaurantIdentityKeyFromOffer,
} from './providerIdentity.js';

describe('Provider Identity', () => {
  it('formats provider entity keys and display labels in one place', () => {
    expect(offerIdentityKey({ provider: 'foodsi', externalId: 'offer-1' })).toBe('foodsi:offer-1');
    expect(providerIdentityLabel({ provider: 'foodsi', externalId: 'restaurant-1' })).toBe('[foodsi:restaurant-1]');
    expect(restaurantIdentityKeyFromOffer({ provider: 'foodsi', restaurantExternalId: 'restaurant-1' })).toBe('foodsi:restaurant-1');
  });

  it('groups external ids by provider for repository lookups', () => {
    const grouped = groupExternalIdsByProvider([
      { provider: 'foodsi', externalId: 'a' },
      { provider: 'foodsi', externalId: 'b' },
      { provider: 'foodsi', externalId: 'a' },
    ]);

    expect(grouped.get('foodsi')).toEqual(new Set(['a', 'b']));
  });
});
