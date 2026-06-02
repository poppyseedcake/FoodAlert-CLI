import type { AlertEvent, UserDisplay } from '../domain/types.js';
import { formatPickup, formatPrice } from '../utils/format.js';

export class ConsoleNotifier {
  notify(user: UserDisplay, event: AlertEvent): void {
    const prefix = `[${user.name}]`;
    const offer = event.offer;

    if (event.type === 'new-offer') {
      console.log(`${prefix} New offer: ${offer.restaurantName} - ${offer.name} (${event.currentQuantity} szt.)`);
    } else if (event.type === 're-stocked') {
      console.log(`${prefix} Re-stocked: ${offer.restaurantName} - ${offer.name} (${event.currentQuantity} szt.)`);
    } else if (event.type === 'sold-out') {
      console.log(`${prefix} Sold out: ${offer.restaurantName} - ${offer.name}`);
    } else {
      console.log(`${prefix} Stock change: ${offer.restaurantName} - ${offer.name} ${event.previousQuantity} -> ${event.currentQuantity}`);
    }

    console.log(`${prefix} ${formatPrice(offer.unitPrice)} / ${formatPrice(offer.originalPrice)} | odbior: ${formatPickup(offer.pickupFrom)} - ${formatPickup(offer.pickupTo)}`);
    if (offer.description) {
      console.log(`${prefix} ${offer.description}`);
    }
  }

  info(user: UserDisplay, message: string): void {
    console.log(`[${user.name}] ${message}`);
  }

  error(user: UserDisplay, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${user.name}] Error: ${message}`);
  }
}
