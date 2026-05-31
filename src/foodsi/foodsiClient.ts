import type { OfferInput, UserProfile } from '../domain/types.js';
import { mapFoodsiOffer } from './mapFoodsiOffer.js';
import type { FoodsiApiResponse } from './foodsiTypes.js';

const FOODSI_AUTH_URL = 'https://api.foodsi.pl/api/v2/auth/sign_in';
const FOODSI_API_BASE = 'https://api.foodsi.pl/api/v3/user/offers';

const FOODSI_HEADERS = {
  'Content-type': 'application/json',
  'system-version': 'android_3.0.0',
  'user-agent': 'okhttp/3.12.0',
};
const MAX_PAGES = 50;

function getTimestamp(): string {
  return new Date().toISOString();
}

function getAuthHeader(value: string | null, name: string): string {
  if (!value) {
    throw new Error(`Foodsi auth response is missing ${name} header`);
  }
  return value;
}

export class FoodsiClient {
  async fetchOffers(user: UserProfile): Promise<OfferInput[]> {
    const authRes = await fetch(FOODSI_AUTH_URL, {
      method: 'POST',
      headers: FOODSI_HEADERS,
      body: JSON.stringify({ email: user.foodsiEmail, password: user.foodsiPassword }),
    });

    if (!authRes.ok) {
      throw new Error(`Foodsi auth failed for ${user.name}: ${authRes.status} ${authRes.statusText}`);
    }

    const authHeaders = {
      ...FOODSI_HEADERS,
      'Access-Token': getAuthHeader(authRes.headers.get('access-token'), 'access-token'),
      Client: getAuthHeader(authRes.headers.get('client'), 'client'),
      Uid: getAuthHeader(authRes.headers.get('uid'), 'uid'),
    };

    const params = new URLSearchParams({
      'filter[package_category_ids][not_eq]': '[13]',
      'filter[package_category_ids][eq]': '[9,1]',
      'filter[active][eq]': 'true',
      'filter[current_quantity][gt]': '0',
      'filter[pickup_to][gt]': getTimestamp(),
      'page[size]': '15',
      sort: 'distance,pickup_from',
    });

    const allItems: OfferInput[] = [];
    let url: string | null = `${FOODSI_API_BASE}?${params}`;
    let pageCount = 0;

    while (url) {
      pageCount += 1;
      if (pageCount > MAX_PAGES) {
        throw new Error(`Foodsi API pagination exceeded ${MAX_PAGES} pages for ${user.name}`);
      }

      const res = await fetch(url, { headers: authHeaders });

      if (!res.ok) {
        throw new Error(`Foodsi API failed for ${user.name}: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as FoodsiApiResponse;
      for (const item of json.data ?? []) {
        allItems.push(mapFoodsiOffer(item));
      }

      url = json.links?.next && json.links.next !== json.links.self ? json.links.next : null;
    }

    return allItems;
  }
}
