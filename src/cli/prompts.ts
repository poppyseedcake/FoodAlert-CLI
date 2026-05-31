import { input, number, password, select } from '@inquirer/prompts';
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
        name: `${restaurant.name} [${restaurant.provider}:${restaurant.externalId}]`,
        value: restaurant.id ?? 0,
      })),
      { name: 'Back', value: 0 },
    ],
  });

  if (restaurantId === 0) return null;
  return restaurants.find((restaurant) => restaurant.id === restaurantId) ?? null;
}

export async function promptNewUser(): Promise<Omit<UserProfile, 'id'>> {
  const name = await input({ message: 'User name' });
  const foodsiEmail = await input({ message: 'Foodsi email' });
  const foodsiPassword = await password({ message: 'Foodsi password', mask: '*' });

  return {
    name,
    foodsiEmail,
    foodsiPassword,
    notifyOnlyFavorites: false,
    watchIntervalMinutes: null,
  };
}

export async function promptMinutes(message: string): Promise<number> {
  const value = await number({ message, default: 5, required: true });
  return Math.max(1, Math.round(value));
}
