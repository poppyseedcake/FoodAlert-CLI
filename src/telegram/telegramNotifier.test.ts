import { describe, expect, it, vi } from 'vitest';
import type { AlertEvent, UserProfile } from '../domain/types.js';
import { TelegramNotifier } from './telegramNotifier.js';

function offer() {
  return {
    provider: 'foodsi' as const,
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
  };
}

function user(): Pick<UserProfile, 'id' | 'name' | 'telegramChatId'> {
  return {
    id: 1,
    name: 'Woj',
    telegramChatId: '123456',
  };
}

describe('TelegramNotifier', () => {
  it('sends formatted alert messages to the configured chat', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const notifier = new TelegramNotifier({ sendMessage } as never);

    const event: AlertEvent = { type: 'new-offer', offer: offer(), previousQuantity: 0, currentQuantity: 4 };

    await notifier.notifyAlerts(user(), [event]);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith('123456', expect.stringContaining('[NEW] Woj | Foodsi'));
  });

  it('splits a large alert presentation into messages accepted by Telegram', async () => {
    const messages: string[] = [];
    const sendMessage = vi.fn(async (_chatId: string, text: string) => {
      if (text.length > 4096) {
        throw new Error('Telegram sendMessage failed: 400 Bad Request: message is too long');
      }
      messages.push(text);
    });
    const notifier = new TelegramNotifier({ sendMessage } as never);
    const events: AlertEvent[] = Array.from({ length: 65 }, (_, index) => ({
      type: 'new-offer',
      offer: {
        ...offer(),
        externalId: `offer-${index}`,
        restaurantExternalId: `restaurant-${index}`,
        restaurantName: `Restaurant ${index}`,
        description: `Long description for offer ${index}. `.repeat(4),
      },
      previousQuantity: 0,
      currentQuantity: 4,
    }));

    await notifier.notifyAlerts(user(), events);

    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 4096)).toBe(true);
    expect(messages.join('\n\n')).toContain('Restaurant 64');
  });
});
