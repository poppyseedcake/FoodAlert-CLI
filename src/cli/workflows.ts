import type { Restaurant } from '../domain/types.js';
import { deleteUser } from '../users/userRepository.js';
import {
  addFavoriteRestaurants,
  addIgnoredRestaurants,
  getRestaurantsByIds,
  listFavoriteRestaurantIds,
  listIgnoredRestaurantIds,
  listRecentlySeenRestaurants,
  listRestaurantsFromCurrentOffers,
  removeFavoriteRestaurants,
  removeIgnoredRestaurants,
} from '../restaurants/restaurantRepository.js';

export type RestaurantListKind = 'favorites' | 'ignored';
export type RestaurantSource = 'current' | 'recent';

type SchedulerForUserDeletion = {
  forgetUser(userId: number): void;
};

type CliWorkflowDeps = {
  deleteUser(userId: number): Promise<void>;
  listFavoriteRestaurantIds(userId: number): Promise<number[]>;
  listIgnoredRestaurantIds(userId: number): Promise<number[]>;
  getRestaurantsByIds(ids: number[]): Promise<Restaurant[]>;
  addFavoriteRestaurants(userId: number, restaurantIds: number[]): Promise<void>;
  addIgnoredRestaurants(userId: number, restaurantIds: number[]): Promise<void>;
  removeFavoriteRestaurants(userId: number, restaurantIds: number[]): Promise<void>;
  removeIgnoredRestaurants(userId: number, restaurantIds: number[]): Promise<void>;
  listRestaurantsFromCurrentOffers(userId: number): Promise<Restaurant[]>;
  listRecentlySeenRestaurants(): Promise<Restaurant[]>;
};

const defaultDeps: CliWorkflowDeps = {
  deleteUser,
  listFavoriteRestaurantIds,
  listIgnoredRestaurantIds,
  getRestaurantsByIds,
  addFavoriteRestaurants,
  addIgnoredRestaurants,
  removeFavoriteRestaurants,
  removeIgnoredRestaurants,
  listRestaurantsFromCurrentOffers,
  listRecentlySeenRestaurants,
};

export function restaurantListLabel(kind: RestaurantListKind): string {
  return kind === 'favorites' ? 'favorites' : 'ignored';
}

export function createCliWorkflows(deps: CliWorkflowDeps = defaultDeps) {
  async function listRestaurantIds(userId: number, kind: RestaurantListKind): Promise<number[]> {
    return kind === 'favorites'
      ? deps.listFavoriteRestaurantIds(userId)
      : deps.listIgnoredRestaurantIds(userId);
  }

  async function listRestaurantsForPicker(userId: number, source: RestaurantSource): Promise<Restaurant[]> {
    return source === 'current'
      ? deps.listRestaurantsFromCurrentOffers(userId)
      : deps.listRecentlySeenRestaurants();
  }

  return {
    async deleteUserProfile(userId: number, scheduler: SchedulerForUserDeletion): Promise<void> {
      scheduler.forgetUser(userId);
      await deps.deleteUser(userId);
    },

    async listRestaurants(userId: number, kind: RestaurantListKind): Promise<Restaurant[]> {
      return deps.getRestaurantsByIds(await listRestaurantIds(userId, kind));
    },

    listRestaurantsForPicker,

    async listAddableRestaurants(userId: number, kind: RestaurantListKind, source: RestaurantSource): Promise<Restaurant[]> {
      const [existingIds, restaurants] = await Promise.all([
        listRestaurantIds(userId, kind),
        listRestaurantsForPicker(userId, source),
      ]);
      const existingIdSet = new Set(existingIds);
      return restaurants.filter((restaurant) => !existingIdSet.has(restaurant.id));
    },

    async addRestaurants(userId: number, kind: RestaurantListKind, restaurantIds: number[]): Promise<void> {
      if (kind === 'favorites') {
        await deps.addFavoriteRestaurants(userId, restaurantIds);
      } else {
        await deps.addIgnoredRestaurants(userId, restaurantIds);
      }
    },

    async removeRestaurants(userId: number, kind: RestaurantListKind, restaurantIds: number[]): Promise<void> {
      if (kind === 'favorites') {
        await deps.removeFavoriteRestaurants(userId, restaurantIds);
      } else {
        await deps.removeIgnoredRestaurants(userId, restaurantIds);
      }
    },
  };
}

export const cliWorkflows = createCliWorkflows();
