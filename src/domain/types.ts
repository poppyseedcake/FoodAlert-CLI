export type Provider = 'foodsi';

export type UserProfile = {
  id: number;
  name: string;
  foodsiEmail: string;
  foodsiPassword: string;
  notifyOnlyFavorites: boolean;
  watchIntervalMinutes: number | null;
  telegramEnabled: boolean;
  telegramChatId: string | null;
  telegramPairingCode: string | null;
  consoleNotificationsEnabled: boolean;
};

export type UserDisplay = {
  id: number;
  name: string;
};

export type Restaurant = {
  id: number;
  provider: Provider;
  externalId: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
};

export type Offer = {
  id: number;
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

export type RestaurantInput = Omit<Restaurant, 'id'>;
export type OfferInput = Omit<Offer, 'id'>;

export type AlertEvent =
  | { type: 'new-offer'; offer: OfferInput; previousQuantity: number; currentQuantity: number }
  | { type: 're-stocked'; offer: OfferInput; previousQuantity: number; currentQuantity: number }
  | { type: 'sold-out'; offer: OfferInput; previousQuantity: number; currentQuantity: number }
  | { type: 'stock-change'; offer: OfferInput; previousQuantity: number; currentQuantity: number };
