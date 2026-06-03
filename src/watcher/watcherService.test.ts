import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDatabase, openDatabaseSession, type DatabaseSession } from '../db/client.js';
import type { OfferInput, UserProfile } from '../domain/types.js';
import { deleteUser } from '../users/userRepository.js';
import { WatcherService } from './watcherService.js';

let tempDir: string;
let session: DatabaseSession;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'foodalert-test-'));
  session = await openDatabaseSession({ path: join(tempDir, 'test.sqlite') });
});

afterEach(() => {
  closeDatabase();
  rmSync(tempDir, { recursive: true, force: true });
});

class MockFoodsiClient {
  constructor(private readonly offersList: OfferInput[]) {}
  async fetchOffers(): Promise<OfferInput[]> {
    return this.offersList;
  }
}

class CapturingNotifier {
  events: Array<{ userId: number; name: string; event: unknown }> = [];
  errorCalls: Array<{ userId: number; name: string; message: string }> = [];

  notify(user: { id: number; name: string }, event: unknown): void {
    this.events.push({ userId: user.id, name: user.name, event });
  }
  info(): void {}
  error(user: { id: number; name: string }, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.errorCalls.push({ userId: user.id, name: user.name, message });
  }
}

function makeOffer(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    provider: 'foodsi',
    externalId: 'offer-1',
    restaurantExternalId: 'rest-1',
    restaurantName: 'Test Rest',
    restaurantLogoUrl: null,
    restaurantAddress: 'Testowa 1',
    name: 'Mystery bag',
    description: null,
    quantity: 3,
    unitPrice: 9.99,
    originalPrice: 19.99,
    pickupFrom: new Date('2025-12-01T10:00:00Z'),
    pickupTo: new Date('2025-12-01T12:00:00Z'),
    distanceKm: 1.5,
    ...overrides,
  };
}

function makeUser(): UserProfile {
  return {
    id: 1,
    name: 'Test',
    foodsiEmail: 't@e.x',
    foodsiPassword: 'xxxxxxxx',
    notifyOnlyFavorites: false,
    watchIntervalMinutes: null,
  };
}

describe('WatcherService.runOnce (sync transaction path)', () => {
  it('persists offers via batch upserts inside a sync transaction', async () => {
    const sqlite = session.sqlite;
    sqlite
      .prepare(
        'INSERT INTO users (id, name, foodsi_email, foodsi_password, notify_only_favorites, watch_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'Test', 't@e.x', 'xxxxxxxx', 0, null, new Date().toISOString(), new Date().toISOString());

    const offersList = [
      makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 5 }),
      makeOffer({ externalId: 'o2', restaurantExternalId: 'r1', quantity: 2 }),
      makeOffer({ externalId: 'o3', restaurantExternalId: 'r2', quantity: 7 }),
    ];
    const notifier = new CapturingNotifier();
    const watcher = new WatcherService(new MockFoodsiClient(offersList) as never, notifier as never);

    await watcher.runOnce(makeUser());

    const allRestaurants = sqlite.prepare('SELECT * FROM restaurants').all();
    const allOffers = sqlite.prepare('SELECT * FROM offers').all();
    const allStates = sqlite.prepare('SELECT * FROM user_offer_states').all();

    expect(allRestaurants).toHaveLength(2);
    expect(allOffers).toHaveLength(3);
    expect(allStates).toHaveLength(3);

    const newOfferEvents = notifier.events.filter((e) => (e.event as { type: string }).type === 'new-offer');
    expect(newOfferEvents).toHaveLength(3);
    expect(notifier.errorCalls).toHaveLength(0);
  });

  it('reuses one restaurant across multiple offers from the same venue', async () => {
    const sqlite = session.sqlite;
    sqlite
      .prepare(
        'INSERT INTO users (id, name, foodsi_email, foodsi_password, notify_only_favorites, watch_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'Test', 't@e.x', 'xxxxxxxx', 0, null, new Date().toISOString(), new Date().toISOString());

    const offersList = [
      makeOffer({ externalId: 'o1', restaurantExternalId: 'r1' }),
      makeOffer({ externalId: 'o2', restaurantExternalId: 'r1' }),
      makeOffer({ externalId: 'o3', restaurantExternalId: 'r1' }),
    ];
    const notifier = new CapturingNotifier();
    const watcher = new WatcherService(new MockFoodsiClient(offersList) as never, notifier as never);

    await watcher.runOnce(makeUser());

    const allRestaurants = sqlite.prepare('SELECT * FROM restaurants').all();
    expect(allRestaurants).toHaveLength(1);
  });

  it('updates existing offers and user states on subsequent batch upserts', async () => {
    const sqlite = session.sqlite;
    sqlite
      .prepare(
        'INSERT INTO users (id, name, foodsi_email, foodsi_password, notify_only_favorites, watch_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'Test', 't@e.x', 'xxxxxxxx', 0, null, new Date().toISOString(), new Date().toISOString());

    await new WatcherService(
      new MockFoodsiClient([makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', name: 'Old name', quantity: 5 })]) as never,
      new CapturingNotifier() as never,
    ).runOnce(makeUser());

    await new WatcherService(
      new MockFoodsiClient([makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', name: 'Updated name', quantity: 1 })]) as never,
      new CapturingNotifier() as never,
    ).runOnce(makeUser());

    const offer = sqlite.prepare('SELECT name, current_quantity FROM offers WHERE external_id = ?').get('o1') as
      | { name: string; current_quantity: number }
      | undefined;
    const state = sqlite.prepare('SELECT current_quantity FROM user_offer_states').get() as
      | { current_quantity: number }
      | undefined;

    expect(offer).toMatchObject({ name: 'Updated name', current_quantity: 1 });
    expect(state).toMatchObject({ current_quantity: 1 });
  });

  it('notifies sold-out and removes user state when a previously seen offer disappears', async () => {
    const sqlite = session.sqlite;
    sqlite
      .prepare(
        'INSERT INTO users (id, name, foodsi_email, foodsi_password, notify_only_favorites, watch_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'Test', 't@e.x', 'xxxxxxxx', 0, null, new Date().toISOString(), new Date().toISOString());

    await new WatcherService(
      new MockFoodsiClient([
        makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 3 }),
        makeOffer({ externalId: 'o2', restaurantExternalId: 'r2', quantity: 4 }),
      ]) as never,
      new CapturingNotifier() as never,
    ).runOnce(makeUser());

    const notifier = new CapturingNotifier();
    await new WatcherService(
      new MockFoodsiClient([makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 3 })]) as never,
      notifier as never,
    ).runOnce(makeUser());

    const soldOutEvents = notifier.events.filter((e) => (e.event as { type: string }).type === 'sold-out');
    const removedState = sqlite
      .prepare(
        'SELECT user_offer_states.* FROM user_offer_states INNER JOIN offers ON user_offer_states.offer_id = offers.id WHERE offers.external_id = ?',
      )
      .get('o2');

    expect(soldOutEvents).toHaveLength(1);
    expect(soldOutEvents[0].event).toMatchObject({
      type: 'sold-out',
      previousQuantity: 4,
      currentQuantity: 0,
      offer: { externalId: 'o2', restaurantExternalId: 'r2', quantity: 0 },
    });
    expect(removedState).toBeUndefined();
  });

  it('rolls back all fetched data when one batch insert fails', async () => {
    const sqlite = session.sqlite;
    sqlite
      .prepare(
        'INSERT INTO users (id, name, foodsi_email, foodsi_password, notify_only_favorites, watch_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'Test', 't@e.x', 'xxxxxxxx', 0, null, new Date().toISOString(), new Date().toISOString());

    const invalidOffer = {
      ...makeOffer({ externalId: 'broken', restaurantExternalId: 'r1' }),
      name: null,
    } as unknown as OfferInput;

    const watcher = new WatcherService(
      new MockFoodsiClient([
        makeOffer({ externalId: 'valid', restaurantExternalId: 'r1' }),
        invalidOffer,
      ]) as never,
      new CapturingNotifier() as never,
    );

    await expect(watcher.runOnce(makeUser())).rejects.toThrow();

    expect(sqlite.prepare('SELECT * FROM restaurants').all()).toHaveLength(0);
    expect(sqlite.prepare('SELECT * FROM offers').all()).toHaveLength(0);
    expect(sqlite.prepare('SELECT * FROM user_offer_states').all()).toHaveLength(0);
  });

  it('deletes user-owned rows without relying on migration-level cascade', async () => {
    const sqlite = session.sqlite;
    const now = new Date().toISOString();
    sqlite
      .prepare(
        'INSERT INTO users (id, name, foodsi_email, foodsi_password, notify_only_favorites, watch_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'Test', 't@e.x', 'xxxxxxxx', 0, null, now, now);
    sqlite
      .prepare(
        'INSERT INTO restaurants (id, provider, external_id, name, logo_url, address, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'foodsi', 'r1', 'Test Rest', null, null, now, now, now);
    sqlite
      .prepare(
        'INSERT INTO offers (id, provider, external_id, restaurant_id, name, description, current_quantity, unit_price, original_price, pickup_from, pickup_to, distance_km, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, 'foodsi', 'o1', 1, 'Offer', null, 2, null, null, null, null, null, now, now, now);
    sqlite.prepare('INSERT INTO user_offer_states (user_id, offer_id, current_quantity, last_seen_at) VALUES (?, ?, ?, ?)').run(1, 1, 2, now);
    sqlite.prepare('INSERT INTO user_favorite_restaurants (user_id, restaurant_id, created_at) VALUES (?, ?, ?)').run(1, 1, now);
    sqlite.prepare('INSERT INTO user_ignored_restaurants (user_id, restaurant_id, created_at) VALUES (?, ?, ?)').run(1, 1, now);

    await deleteUser(1);

    expect(sqlite.prepare('SELECT * FROM users WHERE id = ?').get(1)).toBeUndefined();
    expect(sqlite.prepare('SELECT * FROM user_offer_states WHERE user_id = ?').get(1)).toBeUndefined();
    expect(sqlite.prepare('SELECT * FROM user_favorite_restaurants WHERE user_id = ?').get(1)).toBeUndefined();
    expect(sqlite.prepare('SELECT * FROM user_ignored_restaurants WHERE user_id = ?').get(1)).toBeUndefined();
  });
});
