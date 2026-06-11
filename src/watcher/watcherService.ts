import { deriveAlertEventsForUser } from '../alerts/alertDerivation.js';
import type { AlertEvent, UserDisplay, UserProfile } from '../domain/types.js';
import { FoodsiClient } from '../foodsi/foodsiClient.js';
import { ConsoleNotifier } from '../notifications/consoleNotifier.js';
import { recordOfferSnapshot } from '../offers/offerSnapshot.js';

type TelegramAlertNotifier = {
  notifyAlerts(user: Pick<UserProfile, 'id' | 'name' | 'telegramChatId'>, events: AlertEvent[]): Promise<void> | void;
};

function toDisplay(user: UserProfile): UserDisplay {
  return { id: user.id, name: user.name };
}

export class WatcherService {
  constructor(
    private readonly foodsiClient = new FoodsiClient(),
    private readonly notifier = new ConsoleNotifier(),
    private readonly telegramNotifier: TelegramAlertNotifier | null = null,
  ) {}

  async runOnce(user: UserProfile): Promise<void> {
    const display = toDisplay(user);
    const fetchedOffers = await this.foodsiClient.fetchOffers(user);

    this.notifier.info(display, `Fetched ${fetchedOffers.length} offers.`);

    const changeSet = await recordOfferSnapshot(user.id, fetchedOffers);
    const events = await deriveAlertEventsForUser(user, changeSet);

    const deliveries: Array<Promise<void> | void> = [];

    if (user.consoleNotificationsEnabled) {
      deliveries.push(this.notifier.notifyAlerts(display, events));
    }

    if (user.telegramEnabled && user.telegramChatId && this.telegramNotifier) {
      deliveries.push(this.telegramNotifier.notifyAlerts(user, events));
    } else if (user.telegramEnabled && user.telegramChatId && !this.telegramNotifier) {
      this.notifier.error(display, new Error('Telegram alerts are enabled, but no Telegram notifier is configured.'));
    }

    for (const delivery of deliveries) {
      try {
        await delivery;
      } catch (error) {
        this.notifier.error(display, error);
      }
    }
  }
}
