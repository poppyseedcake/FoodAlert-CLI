import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { closeDatabase, openDatabaseSession, type DatabaseSession } from '../db/client.js';
import type { OfferInput } from '../domain/types.js';
import { listRestaurantsFromCurrentOffers } from '../restaurants/restaurantRepository.js';
import { listCurrentOffersForUser } from './offerRepository.js';
import { recordOfferSnapshot } from './offerSnapshot.js';

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

function insertUser(sqlite: Database.Database, id = 1, name = 'Test'): void {
  sqlite
    .prepare(
      'INSERT INTO users (id, name, foodsi_email, foodsi_password, notify_only_favorites, watch_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, name, `${name.toLowerCase()}@e.x`, 'xxxxxxxx', 0, null, new Date().toISOString(), new Date().toISOString());
}

describe('recordOfferSnapshot', () => {
  it('persists fetched offers and returns current offer change facts', async () => {
    const sqlite = session.sqlite;
    insertUser(sqlite);

    const offers = [
      makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 5 }),
      makeOffer({ externalId: 'o2', restaurantExternalId: 'r1', quantity: 2 }),
      makeOffer({ externalId: 'o3', restaurantExternalId: 'r2', quantity: 7 }),
    ];

    const changeSet = await recordOfferSnapshot(1, offers);

    expect(sqlite.prepare('SELECT * FROM restaurants').all()).toHaveLength(2);
    expect(sqlite.prepare('SELECT * FROM offers').all()).toHaveLength(3);
    expect(sqlite.prepare('SELECT * FROM user_offer_states').all()).toHaveLength(3);
    expect(changeSet.currentOffers).toHaveLength(3);
    expect(changeSet.currentOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          offer: expect.objectContaining({ externalId: 'o1' }),
          previousQuantity: 0,
          offerExistedBefore: false,
        }),
      ]),
    );
    expect(changeSet.disappearedOffers).toHaveLength(0);
  });

  it('returns previous quantity facts when an existing offer changes', async () => {
    const sqlite = session.sqlite;
    insertUser(sqlite);

    await recordOfferSnapshot(1, [makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 5 })]);
    const changeSet = await recordOfferSnapshot(1, [makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 1, distanceKm: 2.5 })]);

    expect(changeSet.currentOffers).toEqual([
      expect.objectContaining({
        offer: expect.objectContaining({ externalId: 'o1', quantity: 1 }),
        previousQuantity: 5,
        offerExistedBefore: true,
      }),
    ]);
    expect(sqlite.prepare('SELECT current_quantity, distance_km FROM user_offer_states').get()).toMatchObject({
      current_quantity: 1,
      distance_km: 2.5,
    });
  });

  it('keeps offer distance per user for the same provider offer', async () => {
    const sqlite = session.sqlite;
    insertUser(sqlite, 1, 'Wroclaw');
    insertUser(sqlite, 2, 'Warsaw');

    await recordOfferSnapshot(1, [makeOffer({ externalId: 'shared', restaurantExternalId: 'r1', distanceKm: 8.5 })]);
    await recordOfferSnapshot(2, [makeOffer({ externalId: 'shared', restaurantExternalId: 'r1', distanceKm: 1.25 })]);

    await expect(listCurrentOffersForUser(1)).resolves.toEqual([
      expect.objectContaining({ externalId: 'shared', distanceKm: 8.5 }),
    ]);
    await expect(listCurrentOffersForUser(2)).resolves.toEqual([
      expect.objectContaining({ externalId: 'shared', distanceKm: 1.25 }),
    ]);
  });

  it('lists current offers by user distance with unknown distances last', async () => {
    const sqlite = session.sqlite;
    insertUser(sqlite);

    await recordOfferSnapshot(1, [
      makeOffer({ externalId: 'far', restaurantExternalId: 'r2', restaurantName: 'Beta', name: 'Far', distanceKm: 7 }),
      makeOffer({ externalId: 'unknown', restaurantExternalId: 'r1', restaurantName: 'Alpha', name: 'Unknown', distanceKm: null }),
      makeOffer({ externalId: 'near', restaurantExternalId: 'r3', restaurantName: 'Gamma', name: 'Near', distanceKm: 1.5 }),
    ]);

    await expect(listCurrentOffersForUser(1)).resolves.toMatchObject([
      { externalId: 'near', distanceKm: 1.5 },
      { externalId: 'far', distanceKm: 7 },
      { externalId: 'unknown', distanceKm: null },
    ]);
  });

  it('lists restaurants from current offers by nearest user distance', async () => {
    const sqlite = session.sqlite;
    insertUser(sqlite);

    await recordOfferSnapshot(1, [
      makeOffer({ externalId: 'alpha-unknown', restaurantExternalId: 'alpha', restaurantName: 'Alpha', distanceKm: null }),
      makeOffer({ externalId: 'beta-far', restaurantExternalId: 'beta', restaurantName: 'Beta', distanceKm: 8 }),
      makeOffer({ externalId: 'beta-near', restaurantExternalId: 'beta', restaurantName: 'Beta', distanceKm: 2 }),
      makeOffer({ externalId: 'gamma-mid', restaurantExternalId: 'gamma', restaurantName: 'Gamma', distanceKm: 3 }),
    ]);

    await expect(listRestaurantsFromCurrentOffers(1)).resolves.toMatchObject([
      { externalId: 'beta', name: 'Beta' },
      { externalId: 'gamma', name: 'Gamma' },
      { externalId: 'alpha', name: 'Alpha' },
    ]);
  });

  it('returns disappeared offer facts and removes vanished user offer states', async () => {
    const sqlite = session.sqlite;
    insertUser(sqlite);

    await recordOfferSnapshot(1, [
      makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 3 }),
      makeOffer({ externalId: 'o2', restaurantExternalId: 'r2', quantity: 4 }),
    ]);

    const changeSet = await recordOfferSnapshot(1, [
      makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 3 }),
    ]);

    expect(changeSet.disappearedOffers).toEqual([
      expect.objectContaining({
        offer: expect.objectContaining({ externalId: 'o2', restaurantExternalId: 'r2', quantity: 0 }),
        previousQuantity: 4,
      }),
    ]);

    const removedState = sqlite
      .prepare(
        'SELECT user_offer_states.* FROM user_offer_states INNER JOIN offers ON user_offer_states.offer_id = offers.id WHERE offers.external_id = ?',
      )
      .get('o2');
    expect(removedState).toBeUndefined();
  });

  it('rolls back the snapshot transaction when one fetched offer cannot be persisted', async () => {
    const sqlite = session.sqlite;
    insertUser(sqlite);

    const invalidOffer = {
      ...makeOffer({ externalId: 'broken', restaurantExternalId: 'r1' }),
      name: null,
    } as unknown as OfferInput;

    await expect(
      recordOfferSnapshot(1, [
        makeOffer({ externalId: 'valid', restaurantExternalId: 'r1' }),
        invalidOffer,
      ]),
    ).rejects.toThrow();

    expect(sqlite.prepare('SELECT * FROM restaurants').all()).toHaveLength(0);
    expect(sqlite.prepare('SELECT * FROM offers').all()).toHaveLength(0);
    expect(sqlite.prepare('SELECT * FROM user_offer_states').all()).toHaveLength(0);
  });
});
