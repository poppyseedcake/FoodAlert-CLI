import { diffOffer, shouldNotifyAboutRestaurant } from '../alerts/diffOffers.js';
import type { UserProfile } from '../domain/types.js';
import { FoodsiClient } from '../foodsi/foodsiClient.js';
import { findUserOfferQuantities, offerQuantityKey, upsertOffer, upsertUserOfferState } from '../offers/offerRepository.js';
import { ConsoleNotifier } from '../notifications/consoleNotifier.js';
import {
  listFavoriteRestaurantIds,
  listIgnoredRestaurantIds,
  restaurantFromOffer,
  upsertRestaurant,
} from '../restaurants/restaurantRepository.js';

export class WatcherService {
  constructor(
    private readonly foodsiClient = new FoodsiClient(),
    private readonly notifier = new ConsoleNotifier(),
  ) {}

  async runOnce(user: UserProfile): Promise<void> {
    const favoriteRestaurantIds = new Set(await listFavoriteRestaurantIds(user.id));
    const ignoredRestaurantIds = new Set(await listIgnoredRestaurantIds(user.id));
    const offers = await this.foodsiClient.fetchOffers(user);
    const previousQuantities = await findUserOfferQuantities(user.id, offers);

    this.notifier.info(user, `Fetched ${offers.length} offers.`);

    for (const offer of offers) {
      try {
        const previousState = previousQuantities.get(offerQuantityKey(offer));
        const previousQuantity = previousState?.quantity ?? 0;
        const offerExistedBefore = previousState?.existed ?? false;
        const restaurantId = await upsertRestaurant(restaurantFromOffer(offer));
        const offerId = await upsertOffer(offer, restaurantId);
        await upsertUserOfferState(user.id, offerId, offer.quantity);

        const event = diffOffer(offer, previousQuantity, offerExistedBefore);
        if (!event) continue;

        const shouldNotify = shouldNotifyAboutRestaurant({
          restaurantId,
          notifyOnlyFavorites: user.notifyOnlyFavorites,
          favoriteRestaurantIds,
          ignoredRestaurantIds,
        });

        if (shouldNotify) {
          this.notifier.notify(user, event);
        }
      } catch (error) {
        this.notifier.error(user, error);
      }
    }
  }
}
