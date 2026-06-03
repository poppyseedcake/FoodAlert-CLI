import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { OfferInput } from '../domain/types.js';

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'foodalert-test-'));
  dbPath = join(tempDir, 'test.sqlite');
  process.env.FOODALERT_DB_PATH = dbPath;
  vi.resetModules();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.FOODALERT_DB_PATH;
  vi.resetModules();
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

function insertUser(sqlite: Database.Database): void {
  sqlite
    .prepare(
      'INSERT INTO users (id, name, foodsi_email, foodsi_password, notify_only_favorites, watch_interval_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(1, 'Test', 't@e.x', 'xxxxxxxx', 0, null, new Date().toISOString(), new Date().toISOString());
}

describe('recordOfferSnapshot', () => {
  it('persists fetched offers and returns current offer change facts', async () => {
    const { initializeDatabase } = await import('../db/client.js');
    const { recordOfferSnapshot } = await import('./offerSnapshot.js');

    await initializeDatabase();
    const sqlite = new Database(dbPath);
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

    sqlite.close();
  });

  it('returns previous quantity facts when an existing offer changes', async () => {
    const { initializeDatabase } = await import('../db/client.js');
    const { recordOfferSnapshot } = await import('./offerSnapshot.js');

    await initializeDatabase();
    const sqlite = new Database(dbPath);
    insertUser(sqlite);

    await recordOfferSnapshot(1, [makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 5 })]);
    const changeSet = await recordOfferSnapshot(1, [makeOffer({ externalId: 'o1', restaurantExternalId: 'r1', quantity: 1 })]);

    expect(changeSet.currentOffers).toEqual([
      expect.objectContaining({
        offer: expect.objectContaining({ externalId: 'o1', quantity: 1 }),
        previousQuantity: 5,
        offerExistedBefore: true,
      }),
    ]);
    expect(sqlite.prepare('SELECT current_quantity FROM user_offer_states').get()).toMatchObject({ current_quantity: 1 });

    sqlite.close();
  });

  it('returns disappeared offer facts and removes vanished user offer states', async () => {
    const { initializeDatabase } = await import('../db/client.js');
    const { recordOfferSnapshot } = await import('./offerSnapshot.js');

    await initializeDatabase();
    const sqlite = new Database(dbPath);
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

    sqlite.close();
  });

  it('rolls back the snapshot transaction when one fetched offer cannot be persisted', async () => {
    const { initializeDatabase } = await import('../db/client.js');
    const { recordOfferSnapshot } = await import('./offerSnapshot.js');

    await initializeDatabase();
    const sqlite = new Database(dbPath);
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

    sqlite.close();
  });
});
