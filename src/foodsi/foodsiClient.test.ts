import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoodsiClient } from './foodsiClient.js';
import type { UserProfile } from '../domain/types.js';

function makeUser(): UserProfile {
  return {
    id: 1,
    name: 'Test',
    foodsiEmail: 't@e.x',
    foodsiPassword: 'xxxxxxxx',
    notifyOnlyFavorites: false,
    watchIntervalMinutes: null,
  };
}

describe('FoodsiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains DNS lookup failures when Foodsi cannot be reached', async () => {
    const dnsError = Object.assign(new Error('getaddrinfo EAI_AGAIN api.foodsi.pl'), {
      code: 'EAI_AGAIN',
      hostname: 'api.foodsi.pl',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed', { cause: dnsError })));

    await expect(new FoodsiClient().fetchOffers(makeUser())).rejects.toThrow(
      'Cannot reach Foodsi while signing in for Test: DNS lookup failed for api.foodsi.pl (EAI_AGAIN). Check your internet connection, DNS, VPN, or try again in a moment.',
    );
  });
});
