export type Provider = 'foodsi';

export type UserProfile = {
  id: number;
  name: string;
  foodsiEmail: string;
  foodsiPassword: string;
  notifyOnlyFavorites: boolean;
  watchIntervalMinutes: number | null;
};

export type Restaurant = {
  id?: number;
  provider: Provider;
  externalId: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
};

export type Offer = {
  id?: number;
  provider: Provider;
  externalId: string;
  restaurantExternalId: string;
  restaurantName: string;
  restaurantLogoUrl: string | null;
  restaurantAddress: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  originalPrice: number | null;
  pickupFrom: Date | null;
  pickupTo: Date | null;
  distanceKm: number | null;
};

export type AlertEvent =
  | { type: 'new-offer'; offer: Offer; previousQuantity: number; currentQuantity: number }
  | { type: 'sold-out'; offer: Offer; previousQuantity: number; currentQuantity: number }
  | { type: 'stock-change'; offer: Offer; previousQuantity: number; currentQuantity: number };
