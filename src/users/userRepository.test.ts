import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDatabase, getDb, openDatabaseSession } from '../db/client.js';
import { users } from '../db/schema.js';
import { createUser, getUser, setAlertPolicy } from './userRepository.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'foodalert-users-'));
  await openDatabaseSession({ path: join(tempDir, 'test.sqlite') });
});

afterEach(() => {
  closeDatabase();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('userRepository', () => {
  it('creates users with low-noise Alert Policy and delivery defaults', async () => {
    const created = await createUser({
      name: 'Woj',
      foodsiEmail: 'woj@example.com',
      foodsiPassword: 'secret123',
      notifyOnlyFavorites: false,
      watchIntervalMinutes: null,
    } as never);

    const user = await getUser(created.id);

    expect(user).toMatchObject({
      telegramEnabled: false,
      telegramChatId: null,
      consoleNotificationsEnabled: true,
      notifyReStocked: true,
      notifyStockChange: false,
      notifySoldOut: false,
    });
  });

  it('updates all optional Alert Policy categories together', async () => {
    const created = await createUser({
      name: 'Woj',
      foodsiEmail: 'woj@example.com',
      foodsiPassword: 'secret123',
      notifyOnlyFavorites: false,
      watchIntervalMinutes: null,
    } as never);

    await setAlertPolicy(created.id, {
      notifyReStocked: false,
      notifyStockChange: true,
      notifySoldOut: true,
    });

    expect(await getUser(created.id)).toMatchObject({
      notifyReStocked: false,
      notifyStockChange: true,
      notifySoldOut: true,
    });
  });

  it('preserves all optional alerts for profiles that rely on migration defaults', async () => {
    const now = new Date().toISOString();
    const rows = await getDb()
      .insert(users)
      .values({
        name: 'Existing',
        foodsiEmail: 'existing@example.com',
        foodsiPassword: 'secret123',
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id });

    expect(await getUser(rows[0].id)).toMatchObject({
      notifyReStocked: true,
      notifyStockChange: true,
      notifySoldOut: true,
    });
  });
});
