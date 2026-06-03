import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_WATCH_INTERVAL_MINUTES } from '../domain/constants.js';
import { appSettings } from './schema.js';
import { closeDatabase, getDb, openDatabaseSession } from './client.js';

let tempDir: string | null = null;

function testDbPath(): string {
  tempDir = mkdtempSync(join(tmpdir(), 'foodalert-db-session-'));
  return join(tempDir, 'test.sqlite');
}

afterEach(() => {
  closeDatabase();
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('Database Session', () => {
  it('opens, migrates, and seeds a database at the requested path', async () => {
    const session = await openDatabaseSession({ path: testDbPath() });

    expect(session.sqlite.open).toBe(true);
    expect(getDb()).toBe(session.db);

    const settings = await session.db.select().from(appSettings).limit(1);
    expect(settings[0]).toMatchObject({
      id: 1,
      defaultWatchIntervalMinutes: DEFAULT_WATCH_INTERVAL_MINUTES,
    });
  });

  it('makes repository access fail clearly when no session is open', () => {
    closeDatabase();

    expect(() => getDb()).toThrow('Database session is not open');
  });
});
