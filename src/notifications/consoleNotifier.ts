import type { AlertEvent, UserProfile } from '../domain/types.js';

function formatPickup(date: Date | null): string {
  if (!date) return '?';
  return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatPrice(value: number | null): string {
  return value === null ? '?' : `${value} PLN`;
}

export class ConsoleNotifier {
  notify(user: UserProfile, event: AlertEvent): void {
    const prefix = `[${user.name}]`;
    const offer = event.offer;

    if (event.type === 'new-offer') {
      console.log(`${prefix} New offer: ${offer.restaurantName} - ${offer.name} (${event.currentQuantity} szt.)`);
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

  info(user: UserProfile, message: string): void {
    console.log(`[${user.name}] ${message}`);
  }

  error(user: UserProfile, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${user.name}] Error: ${message}`);
  }
}
