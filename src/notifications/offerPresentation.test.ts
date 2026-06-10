import { describe, expect, it } from 'vitest';
import type { AlertEvent, OfferInput } from '../domain/types.js';
import { formatAlertPresentation, formatCurrentOfferPresentation } from './offerPresentation.js';

function offer(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    provider: 'foodsi',
    externalId: 'offer-1',
    restaurantExternalId: 'restaurant-1',
    restaurantName: 'Nugat Cukiernia',
    restaurantLogoUrl: null,
    restaurantAddress: null,
    name: 'Paczka niespodzianka',
    description: 'Pieczywo i ciasta.',
    quantity: 4,
    unitPrice: 14.99,
    originalPrice: 30,
    pickupFrom: new Date('2026-06-10T13:25:00Z'),
    pickupTo: new Date('2026-06-10T18:30:00Z'),
    distanceKm: 1,
    ...overrides,
  };
}

describe('formatOfferPresentation', () => {
  it('groups current offers from one restaurant under one compact heading', () => {
    const result = formatCurrentOfferPresentation(
      { id: 1, name: 'Woj' },
      [
        offer(),
        offer({
          externalId: 'offer-2',
          name: 'Extra paczka',
          description: 'Kawa i wypieki.',
          quantity: 1,
        }),
      ],
    );

    expect(result).toBe([
      '[CURRENT] Woj | Foodsi',
      'Nugat Cukiernia',
      '  Paczka niespodzianka (4 szt.)',
      '    14.99 PLN / 30 PLN | odbior: 10.06, 15:25 - 10.06, 20:30',
      '    Pieczywo i ciasta.',
      '  Extra paczka (1 szt.)',
      '    14.99 PLN / 30 PLN | odbior: 10.06, 15:25 - 10.06, 20:30',
      '    Kawa i wypieki.',
    ].join('\n'));
  });

  it('keeps offers from each restaurant together and separates restaurant groups', () => {
    const result = formatCurrentOfferPresentation(
      { id: 1, name: 'Woj' },
      [
        offer({ externalId: 'nugat-1', name: 'Nugat first' }),
        offer({
          externalId: 'bistro-1',
          restaurantExternalId: 'restaurant-2',
          restaurantName: 'Bistro Party',
          name: 'Bistro offer',
        }),
        offer({ externalId: 'nugat-2', name: 'Nugat second' }),
      ],
    );

    expect(result).toContain([
      '[CURRENT] Woj | Foodsi',
      'Nugat Cukiernia',
      '  Nugat first (4 szt.)',
    ].join('\n'));
    expect(result).toContain('  Nugat second (4 szt.)');
    expect(result).toContain('\n\n[CURRENT] Woj | Foodsi\nBistro Party\n');
    expect(result.indexOf('Nugat second')).toBeLessThan(result.indexOf('Bistro Party'));
  });

  it('uses short alert statuses and preserves stock quantity changes', () => {
    const events: AlertEvent[] = [
      { type: 'new-offer', offer: offer({ externalId: 'new', name: 'New bag', quantity: 4 }), previousQuantity: 0, currentQuantity: 4 },
      { type: 'sold-out', offer: offer({ externalId: 'sold', name: 'Sold bag', quantity: 0 }), previousQuantity: 2, currentQuantity: 0 },
      { type: 'stock-change', offer: offer({ externalId: 'stock', name: 'Changed bag', quantity: 1 }), previousQuantity: 5, currentQuantity: 1 },
    ];

    const result = formatAlertPresentation({ id: 1, name: 'Woj' }, events);

    expect(result).toContain('[NEW/SOLD/STOCK] Woj | Foodsi\nNugat Cukiernia');
    expect(result).toContain('  New bag (4 szt.)');
    expect(result).toContain('  Sold bag (0 szt.)');
    expect(result).toContain('  Changed bag (5 -> 1 szt.)');
  });
});
