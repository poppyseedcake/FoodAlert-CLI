import { deriveAlertEventsForUser } from '../alerts/alertDerivation.js';
import type { UserDisplay, UserProfile } from '../domain/types.js';
import { FoodsiClient } from '../foodsi/foodsiClient.js';
import { ConsoleNotifier } from '../notifications/consoleNotifier.js';
import { recordOfferSnapshot } from '../offers/offerSnapshot.js';

function toDisplay(user: UserProfile): UserDisplay {
  return { id: user.id, name: user.name };
}

export class WatcherService {
  constructor(
    private readonly foodsiClient = new FoodsiClient(),
    private readonly notifier = new ConsoleNotifier(),
  ) {}

  async runOnce(user: UserProfile): Promise<void> {
    const display = toDisplay(user);
    const fetchedOffers = await this.foodsiClient.fetchOffers(user);

    this.notifier.info(display, `Fetched ${fetchedOffers.length} offers.`);

    const changeSet = await recordOfferSnapshot(user.id, fetchedOffers);
    const events = await deriveAlertEventsForUser(user, changeSet);

    for (const event of events) {
      this.notifier.notify(display, event);
    }
  }
}
