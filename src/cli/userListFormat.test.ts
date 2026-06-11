import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../domain/types.js';
import { formatUserListEntry } from './userListFormat.js';

const user = (id: number, name: string): UserProfile => ({
  id,
  name,
  foodsiEmail: `${name.toLowerCase()}@e.x`,
  foodsiPassword: 'xxxxxxxx',
  notifyOnlyFavorites: false,
  watchIntervalMinutes: null,
  telegramEnabled: false,
  telegramChatId: null,
  telegramPairingCode: null,
  consoleNotificationsEnabled: true,
});

describe('formatUserListEntry', () => {
  it('numbers users by visible position instead of database id', () => {
    expect(formatUserListEntry(0, user(4, 'Woj'))).toBe(
      '1. Woj | woj@e.x | interval: default | only favorites: false | console: on | telegram: off',
    );
  });
});
