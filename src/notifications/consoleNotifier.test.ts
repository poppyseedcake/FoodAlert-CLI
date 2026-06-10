import { describe, expect, it, vi } from 'vitest';
import type { OfferInput } from '../domain/types.js';
import { ConsoleNotifier } from './consoleNotifier.js';

function offer(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    provider: 'foodsi',
    externalId: 'offer-1',
    restaurantExternalId: 'restaurant-1',
    restaurantName: 'Nugat Cukiernia',
    restaurantLogoUrl: null,
    restaurantAddress: null,
    name: 'Paczka niespodzianka',
    description: null,
    quantity: 4,
    unitPrice: 14.99,
    originalPrice: 30,
    pickupFrom: null,
    pickupTo: null,
    distanceKm: 1,
    ...overrides,
  };
}

describe('ConsoleNotifier', () => {
  it('prints current offers using the shared grouped presentation', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    new ConsoleNotifier().showCurrentOffers(
      { id: 1, name: 'Woj' },
      [
        offer(),
        offer({ externalId: 'offer-2', name: 'Extra paczka' }),
      ],
    );

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain('[CURRENT] Woj | Foodsi\nNugat Cukiernia');
    expect(log.mock.calls[0][0].match(/Nugat Cukiernia/g)).toHaveLength(1);

    log.mockRestore();
  });

  it('prints alert events together using short statuses', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const first = offer();
    const second = offer({ externalId: 'offer-2', name: 'Extra paczka', quantity: 0 });

    new ConsoleNotifier().notifyAlerts(
      { id: 1, name: 'Woj' },
      [
        { type: 'new-offer', offer: first, previousQuantity: 0, currentQuantity: 4 },
        { type: 'sold-out', offer: second, previousQuantity: 1, currentQuantity: 0 },
      ],
    );

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain('[NEW/SOLD] Woj | Foodsi\nNugat Cukiernia');
    expect(log.mock.calls[0][0].match(/Nugat Cukiernia/g)).toHaveLength(1);

    log.mockRestore();
  });
});
