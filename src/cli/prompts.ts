import { checkbox, input, number, password, select } from '@inquirer/prompts';
import { DEFAULT_WATCH_INTERVAL_MINUTES, MIN_WATCH_INTERVAL_MINUTES } from '../domain/constants.js';
import { providerIdentityLabel } from '../domain/providerIdentity.js';
import type { Restaurant, UserProfile } from '../domain/types.js';

export async function selectUser(users: UserProfile[]): Promise<UserProfile | null> {
  if (users.length === 0) {
    console.log('No users found.');
    return null;
  }

  const userId = await select({
    message: 'Choose user',
    choices: [
      ...users.map((user) => ({ name: `${user.name} (${user.foodsiEmail})`, value: user.id })),
      { name: 'Back', value: 0 },
    ],
  });

  if (userId === 0) return null;
  return users.find((user) => user.id === userId) ?? null;
}

export async function selectRestaurant(restaurants: Restaurant[]): Promise<Restaurant | null> {
  if (restaurants.length === 0) {
    console.log('No restaurants found. Run Foodsi fetch first.');
    return null;
  }

  const restaurantId = await select({
    message: 'Choose restaurant',
    choices: [
      ...restaurants.map((restaurant) => ({
        name: `${restaurant.name} ${providerIdentityLabel(restaurant)}`,
        value: restaurant.id,
      })),
      { name: 'Back', value: 0 },
    ],
  });

  if (restaurantId === 0) return null;
  return restaurants.find((restaurant) => restaurant.id === restaurantId) ?? null;
}

export async function selectRestaurants(restaurants: Restaurant[], message: string): Promise<Restaurant[]> {
  if (restaurants.length === 0) return [];

  const ids = await checkbox<number>({
    message,
    pageSize: 20,
    choices: restaurants.map((restaurant) => ({
      name: `${restaurant.name} ${providerIdentityLabel(restaurant)}`,
      value: restaurant.id,
    })),
  });

  const idSet = new Set(ids);
  return restaurants.filter((restaurant) => idSet.has(restaurant.id));
}

export async function promptNewUser(): Promise<Omit<UserProfile, 'id'>> {
  const name = await input({
    message: 'User name',
    required: true,
    validate: (value) => value.trim().length > 0 || 'User name is required',
  });
  const foodsiEmail = await input({
    message: 'Foodsi email',
    required: true,
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Enter a valid email address',
  });
  const foodsiPassword = await password({
    message: 'Foodsi password',
    mask: '*',
    validate: (value) => value.length >= 8 || 'Password must have at least 8 characters',
  });

  return {
    name: name.trim(),
    foodsiEmail: foodsiEmail.trim(),
    foodsiPassword,
    notifyOnlyFavorites: false,
    watchIntervalMinutes: null,
    telegramEnabled: false,
    telegramChatId: null,
    telegramPairingCode: null,
    consoleNotificationsEnabled: true,
  };
}

export async function promptMinutes(message: string): Promise<number> {
  const value = await number({ message, default: DEFAULT_WATCH_INTERVAL_MINUTES, required: true });
  return Math.max(MIN_WATCH_INTERVAL_MINUTES, Math.round(value));
}
