import type { UserProfile } from '../domain/types.js';

export function formatUserListEntry(position: number, user: UserProfile): string {
  const interval = user.watchIntervalMinutes ? `${user.watchIntervalMinutes} min` : 'default';
  return `${position + 1}. ${user.name} | ${user.foodsiEmail} | interval: ${interval} | only favorites: ${user.notifyOnlyFavorites}`;
}
