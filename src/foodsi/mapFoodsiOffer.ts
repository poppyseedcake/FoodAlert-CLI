import type { OfferInput } from '../domain/types.js';
import type { FoodsiApiItem } from './foodsiTypes.js';

function parseDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

function parseNumber(value: number | string | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function mapFoodsiOffer(item: FoodsiApiItem): OfferInput | null {
  const attributes = item.attributes;
  const venueId = attributes.venue_id;
  const venueName = attributes.venue_name;

  if (venueId == null && (venueName == null || venueName.trim() === '')) {
    return null;
  }

  const restaurantExternalId =
    venueId != null
      ? String(venueId)
      : `${venueName!.trim()}|${(attributes.venue_address ?? '').trim()}`;

  return {
    provider: 'foodsi',
    externalId: item.id,
    restaurantExternalId,
    restaurantName: attributes.venue_name ?? 'Unknown restaurant',
    restaurantLogoUrl: attributes.venue_logo ?? null,
    restaurantAddress: attributes.venue_address ?? null,
    name: attributes.name ?? 'Foodsi offer',
    description: attributes.description ?? null,
    quantity: attributes.current_quantity ?? 0,
    unitPrice: parseNumber(attributes.unit_price),
    originalPrice: parseNumber(attributes.original_price),
    pickupFrom: parseDate(attributes.pickup_from),
    pickupTo: parseDate(attributes.pickup_to),
    distanceKm: parseNumber(attributes.distance),
  };
}
