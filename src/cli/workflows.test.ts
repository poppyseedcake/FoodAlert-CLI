import { describe, expect, it, vi } from 'vitest';
import type { Restaurant } from '../domain/types.js';
import { createCliWorkflows, restaurantListLabel } from './workflows.js';

const restaurant = (id: number): Restaurant => ({
  id,
  provider: 'foodsi',
  externalId: `r${id}`,
  name: `Restaurant ${id}`,
  logoUrl: null,
  address: null,
});

describe('CLI Workflows', () => {
  it('forgets a user in the scheduler before deleting the profile', async () => {
    const order: string[] = [];
    const scheduler = { forgetUser: vi.fn(() => { order.push('forget'); }) };
    const workflows = createCliWorkflows({
      ...stubDeps(),
      deleteUser: vi.fn(async () => { order.push('delete'); }),
    });

    await workflows.deleteUserProfile(1, scheduler);

    expect(scheduler.forgetUser).toHaveBeenCalledWith(1);
    expect(order).toEqual(['forget', 'delete']);
  });

  it('lists only restaurants that can still be added to a list', async () => {
    const workflows = createCliWorkflows({
      ...stubDeps(),
      listFavoriteRestaurantIds: vi.fn(async () => [1]),
      listRestaurantsFromCurrentOffers: vi.fn(async () => [restaurant(1), restaurant(2)]),
    });

    await expect(workflows.listAddableRestaurants(5, 'favorites', 'current')).resolves.toEqual([restaurant(2)]);
  });

  it('routes favorite and ignored mutations through the matching repositories', async () => {
    const addFavorites = vi.fn(async () => undefined);
    const addIgnored = vi.fn(async () => undefined);
    const removeFavorites = vi.fn(async () => undefined);
    const removeIgnored = vi.fn(async () => undefined);
    const workflows = createCliWorkflows({
      ...stubDeps(),
      addFavoriteRestaurants: addFavorites,
      addIgnoredRestaurants: addIgnored,
      removeFavoriteRestaurants: removeFavorites,
      removeIgnoredRestaurants: removeIgnored,
    });

    await workflows.addRestaurants(1, 'favorites', [2]);
    await workflows.addRestaurants(1, 'ignored', [3]);
    await workflows.removeRestaurants(1, 'favorites', [4]);
    await workflows.removeRestaurants(1, 'ignored', [5]);

    expect(addFavorites).toHaveBeenCalledWith(1, [2]);
    expect(addIgnored).toHaveBeenCalledWith(1, [3]);
    expect(removeFavorites).toHaveBeenCalledWith(1, [4]);
    expect(removeIgnored).toHaveBeenCalledWith(1, [5]);
  });

  it('names restaurant lists consistently', () => {
    expect(restaurantListLabel('favorites')).toBe('favorites');
    expect(restaurantListLabel('ignored')).toBe('ignored');
  });
});

function stubDeps() {
  return {
    deleteUser: vi.fn(async () => undefined),
    listFavoriteRestaurantIds: vi.fn(async () => []),
    listIgnoredRestaurantIds: vi.fn(async () => []),
    getRestaurantsByIds: vi.fn(async () => []),
    addFavoriteRestaurants: vi.fn(async () => undefined),
    addIgnoredRestaurants: vi.fn(async () => undefined),
    removeFavoriteRestaurants: vi.fn(async () => undefined),
    removeIgnoredRestaurants: vi.fn(async () => undefined),
    listRestaurantsFromCurrentOffers: vi.fn(async () => []),
    listRecentlySeenRestaurants: vi.fn(async () => []),
  };
}
