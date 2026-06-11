import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDatabase, openDatabaseSession } from '../db/client.js';
import { createUser, getUser } from './userRepository.js';

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
  it('creates users with Telegram disabled and console notifications enabled by default', async () => {
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
    });
  });
});
