import type { UserProfile } from '../domain/types.js';

export function formatUserListEntry(position: number, user: UserProfile): string {
  const interval = user.watchIntervalMinutes ? `${user.watchIntervalMinutes} min` : 'default';
  const alertCategories = [
    'new',
    ...(user.notifyReStocked ? ['re-stocked'] : []),
    ...(user.notifyStockChange ? ['stock-change'] : []),
    ...(user.notifySoldOut ? ['sold-out'] : []),
  ].join(', ');
  const consoleNotifications = user.consoleNotificationsEnabled ? 'on' : 'off';
  const telegramNotifications = user.telegramEnabled ? 'on' : 'off';
  return `${position + 1}. ${user.name} | ${user.foodsiEmail} | interval: ${interval} | only favorites: ${user.notifyOnlyFavorites} | alerts: ${alertCategories} | console: ${consoleNotifications} | telegram: ${telegramNotifications}`;
}
