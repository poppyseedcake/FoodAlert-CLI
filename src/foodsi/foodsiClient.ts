import type { OfferInput, UserProfile } from '../domain/types.js';
import { mapFoodsiOffer } from './mapFoodsiOffer.js';
import type { FoodsiApiResponse } from './foodsiTypes.js';

// Spoofed Android client headers — Foodsi's public API requires them, but the values
// must be updated when the official Android app bumps its version. If the API rejects
// the request with 401, check this first.
const FOODSI_AUTH_URL = 'https://api.foodsi.pl/api/v2/auth/sign_in';
const FOODSI_API_BASE = 'https://api.foodsi.pl/api/v3/user/offers';

const FOODSI_HEADERS = {
  'Content-type': 'application/json',
  'system-version': 'android_3.0.0',
  'user-agent': 'okhttp/3.12.0',
};
const MAX_PAGES = 50;

function readCause(error: unknown): unknown {
  return error instanceof Error && 'cause' in error ? error.cause : undefined;
}

function readErrorField(error: unknown, field: 'code' | 'hostname'): string | undefined {
  if (!error || typeof error !== 'object' || !(field in error)) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

function explainFetchFailure(error: unknown, context: string): Error {
  const cause = readCause(error);
  const code = readErrorField(cause, 'code');
  const hostname = readErrorField(cause, 'hostname') ?? 'api.foodsi.pl';

  if (code === 'EAI_AGAIN') {
    return new Error(
      `Cannot reach Foodsi while ${context}: DNS lookup failed for ${hostname} (${code}). Check your internet connection, DNS, VPN, or try again in a moment.`,
      { cause: error },
    );
  }

  if (code) {
    return new Error(`Cannot reach Foodsi while ${context}: network error ${code} for ${hostname}.`, { cause: error });
  }

  return new Error(`Cannot reach Foodsi while ${context}: ${error instanceof Error ? error.message : String(error)}`, {
    cause: error,
  });
}

async function fetchFoodsi(url: string, init: RequestInit, context: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw explainFetchFailure(error, context);
  }
}

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
    const authRes = await fetchFoodsi(FOODSI_AUTH_URL, {
      method: 'POST',
      headers: FOODSI_HEADERS,
      body: JSON.stringify({ email: user.foodsiEmail, password: user.foodsiPassword }),
    }, `signing in for ${user.name}`);

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

      const res = await fetchFoodsi(url, { headers: authHeaders }, `fetching offers for ${user.name}`);

      if (!res.ok) {
        throw new Error(`Foodsi API failed for ${user.name}: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as FoodsiApiResponse;
      for (const item of json.data ?? []) {
        const mapped = mapFoodsiOffer(item);
        if (mapped) {
          allItems.push(mapped);
        }
      }

      url = json.links?.next && json.links.next !== json.links.self ? json.links.next : null;
    }

    return allItems;
  }
}
