import type { AlertEvent, OfferInput, UserDisplay } from '../domain/types.js';
import { formatPickup, formatPrice } from '../utils/format.js';

type OfferPresentationEntry = {
  status: string;
  offer: OfferInput;
  quantityLabel?: string;
};

function formatRestaurantGroup(user: UserDisplay, entries: OfferPresentationEntry[]): string {
  const firstOffer = entries[0].offer;
  const statuses = [...new Set(entries.map((entry) => entry.status))].join('/');
  const lines = [
    `[${statuses}] ${user.name} | Foodsi`,
    firstOffer.restaurantName,
  ];

  for (const { offer, quantityLabel = String(offer.quantity) } of entries) {
    lines.push(`  ${offer.name} (${quantityLabel} szt.)`);
    lines.push(`    ${formatPrice(offer.unitPrice)} / ${formatPrice(offer.originalPrice)} | odbior: ${formatPickup(offer.pickupFrom)} - ${formatPickup(offer.pickupTo)}`);
    if (offer.description) {
      lines.push(`    ${offer.description}`);
    }
  }

  return lines.join('\n');
}

function formatOfferPresentation(user: UserDisplay, entries: OfferPresentationEntry[]): string {
  const restaurantGroups = new Map<string, OfferPresentationEntry[]>();

  for (const entry of entries) {
    const key = `${entry.offer.provider}:${entry.offer.restaurantExternalId}`;
    const group = restaurantGroups.get(key) ?? [];
    group.push(entry);
    restaurantGroups.set(key, group);
  }

  return [...restaurantGroups.values()]
    .map((group) => formatRestaurantGroup(user, group))
    .join('\n\n');
}

function alertStatus(event: AlertEvent): string {
  if (event.type === 'new-offer') return 'NEW';
  if (event.type === 're-stocked') return 'RESTOCK';
  if (event.type === 'sold-out') return 'SOLD';
  return 'STOCK';
}

export function formatAlertPresentation(user: UserDisplay, events: AlertEvent[]): string {
  return formatOfferPresentation(
    user,
    events.map((event) => ({
      status: alertStatus(event),
      offer: event.offer,
      quantityLabel: event.type === 'stock-change'
        ? `${event.previousQuantity} -> ${event.currentQuantity}`
        : String(event.currentQuantity),
    })),
  );
}

export function formatCurrentOfferPresentation(user: UserDisplay, offers: OfferInput[]): string {
  return formatOfferPresentation(
    user,
    offers.map((offer) => ({ status: 'CURRENT', offer })),
  );
}
