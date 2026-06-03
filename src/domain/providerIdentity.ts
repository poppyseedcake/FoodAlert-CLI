import type { OfferInput, Provider, RestaurantInput } from './types.js';

export type ProviderEntityRef = {
  provider: Provider;
  externalId: string;
};

export type ProviderIdentityKey = `${Provider}:${string}`;

export function providerIdentityKey(ref: ProviderEntityRef): ProviderIdentityKey {
  return `${ref.provider}:${ref.externalId}`;
}

export function providerIdentityLabel(ref: ProviderEntityRef): string {
  return `[${providerIdentityKey(ref)}]`;
}

export function offerIdentityKey(offer: Pick<OfferInput, 'provider' | 'externalId'>): ProviderIdentityKey {
  return providerIdentityKey(offer);
}

export function restaurantIdentityKey(restaurant: Pick<RestaurantInput, 'provider' | 'externalId'>): ProviderIdentityKey {
  return providerIdentityKey(restaurant);
}

export function restaurantIdentityKeyFromOffer(offer: Pick<OfferInput, 'provider' | 'restaurantExternalId'>): ProviderIdentityKey {
  return providerIdentityKey({ provider: offer.provider, externalId: offer.restaurantExternalId });
}

export function groupExternalIdsByProvider(refs: ProviderEntityRef[]): Map<Provider, Set<string>> {
  const result = new Map<Provider, Set<string>>();
  for (const ref of refs) {
    const ids = result.get(ref.provider) ?? new Set<string>();
    ids.add(ref.externalId);
    result.set(ref.provider, ids);
  }
  return result;
}
