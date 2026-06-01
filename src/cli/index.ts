import { confirm, select } from '@inquirer/prompts';
import type { Restaurant } from '../domain/types.js';
import { closeDatabase, initializeDatabase } from '../db/client.js';
import {
  createUser,
  getDefaultWatchIntervalMinutes,
  listUsers,
  setDefaultWatchIntervalMinutes,
  setNotifyOnlyFavorites,
  setUserWatchInterval,
} from '../users/userRepository.js';
import {
  addFavoriteRestaurant,
  addIgnoredRestaurant,
  getRestaurantsByIds,
  listFavoriteRestaurantIds,
  listIgnoredRestaurantIds,
  listRecentlySeenRestaurants,
  listRestaurantsFromCurrentOffers,
  removeFavoriteRestaurant,
  removeIgnoredRestaurant,
} from '../restaurants/restaurantRepository.js';
import { clearCurrentOffersForUser, listCurrentOffersForUser } from '../offers/offerRepository.js';
import { SchedulerService } from '../watcher/schedulerService.js';
import { WatcherService } from '../watcher/watcherService.js';
import { formatPickup, formatPrice } from '../utils/format.js';
import { promptMinutes, promptNewUser, selectRestaurant, selectUser } from './prompts.js';

type MainAction =
  | 'users'
  | 'run-once'
  | 'watch-user'
  | 'watch-all'
  | 'stop-watchers'
  | 'offers'
  | 'restaurants'
  | 'settings'
  | 'exit';

const scheduler = new SchedulerService();
let isShuttingDown = false;

async function shutdown(exitCode = 0): Promise<never> {
  if (isShuttingDown) {
    process.exit(exitCode);
  }

  isShuttingDown = true;
  scheduler.stop();
  closeDatabase();
  process.exit(exitCode);
}

process.once('SIGINT', () => {
  void shutdown(130);
});

process.once('SIGTERM', () => {
  void shutdown(143);
});

async function usersMenu(): Promise<void> {
  while (true) {
    const action = await select({
      message: 'Users',
      choices: [
        { name: 'Add user', value: 'add-user' },
        { name: 'List users', value: 'list-users' },
        { name: 'Back', value: 'back' },
      ],
    });

    if (action === 'back') return;

    if (action === 'add-user') {
      const user = await createUser(await promptNewUser());
      console.log(`Created user ${user.name}.`);
    } else {
      const users = await listUsers();
      for (const user of users) {
        const interval = user.watchIntervalMinutes ? `${user.watchIntervalMinutes} min` : 'default';
        console.log(`${user.id}. ${user.name} | ${user.foodsiEmail} | interval: ${interval} | only favorites: ${user.notifyOnlyFavorites}`);
      }
    }
  }
}

async function settingsMenu(): Promise<void> {
  while (true) {
    const action = await select({
      message: 'Settings',
      choices: [
        { name: 'Set global default interval', value: 'global' },
        { name: 'Set user interval', value: 'user' },
        { name: 'Clear user interval', value: 'clear-user' },
        { name: 'Toggle only favorites for user', value: 'favorites-only' },
        { name: 'Back', value: 'back' },
      ],
    });

    if (action === 'back') return;

    if (action === 'global') {
      const minutes = await promptMinutes('Default interval in minutes');
      await setDefaultWatchIntervalMinutes(minutes);
      console.log(`Global default interval set to ${minutes} min.`);
      continue;
    }

    const user = await selectUser(await listUsers());
    if (!user) continue;

    if (action === 'user') {
      const minutes = await promptMinutes('User interval in minutes');
      await setUserWatchInterval(user.id, minutes);
      console.log(`User interval set to ${minutes} min.`);
    } else if (action === 'clear-user') {
      await setUserWatchInterval(user.id, null);
      console.log('User interval cleared.');
    } else {
      const currentStatus = user.notifyOnlyFavorites ? 'ON' : 'OFF';
      const enabled = await confirm({
        message: `[${user.name}] Current: ${currentStatus} — Notify only about favorite restaurants?`,
        default: !user.notifyOnlyFavorites,
      });
      await setNotifyOnlyFavorites(user.id, enabled);
      console.log(`Only favorites: ${enabled ? 'ON' : 'OFF'}.`);
    }
  }
}

async function chooseRestaurantSource(userId: number): Promise<Restaurant[] | null> {
  const source = await select({
    message: 'Restaurant source',
    choices: [
      { name: 'Current offers', value: 'current' },
      { name: 'Recently seen restaurants', value: 'recent' },
      { name: 'Back', value: 'back' },
    ],
  });

  if (source === 'back') return null;
  return source === 'current' ? listRestaurantsFromCurrentOffers(userId) : listRecentlySeenRestaurants();
}

async function restaurantsMenu(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;

  while (true) {
    const action = await select({
      message: 'Restaurants',
      choices: [
        { name: 'Add favorite', value: 'add-favorite' },
        { name: 'Remove favorite', value: 'remove-favorite' },
        { name: 'Add ignored', value: 'add-ignored' },
        { name: 'Remove ignored', value: 'remove-ignored' },
        { name: 'List favorites', value: 'list-favorites' },
        { name: 'List ignored', value: 'list-ignored' },
        { name: 'Back', value: 'back' },
      ],
    });

    if (action === 'back') return;

    if (action === 'list-favorites' || action === 'list-ignored') {
      const ids = action === 'list-favorites' ? await listFavoriteRestaurantIds(user.id) : await listIgnoredRestaurantIds(user.id);
      const restaurants = await getRestaurantsByIds(ids);
      for (const restaurant of restaurants) {
        console.log(`${restaurant.id}. ${restaurant.name} [${restaurant.provider}:${restaurant.externalId}]`);
      }
      continue;
    }

    const restaurants =
      action === 'remove-favorite'
        ? await getRestaurantsByIds(await listFavoriteRestaurantIds(user.id))
        : action === 'remove-ignored'
          ? await getRestaurantsByIds(await listIgnoredRestaurantIds(user.id))
          : await chooseRestaurantSource(user.id);

    if (restaurants === null) continue;

    const restaurant = await selectRestaurant(restaurants);
    if (!restaurant) continue;

    if (action === 'add-favorite') {
      await addFavoriteRestaurant(user.id, restaurant.id);
      console.log('Added favorite restaurant.');
    } else if (action === 'remove-favorite') {
      await removeFavoriteRestaurant(user.id, restaurant.id);
      console.log('Removed favorite restaurant.');
    } else if (action === 'add-ignored') {
      await addIgnoredRestaurant(user.id, restaurant.id);
      console.log('Added ignored restaurant.');
    } else {
      await removeIgnoredRestaurant(user.id, restaurant.id);
      console.log('Removed ignored restaurant.');
    }
  }
}

async function offersMenu(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;

  while (true) {
    const action = await select({
      message: 'Offers',
      choices: [
        { name: 'Show current offers', value: 'show' },
        { name: 'Clear current offers', value: 'clear' },
        { name: 'Back', value: 'back' },
      ],
    });

    if (action === 'back') return;

    if (action === 'clear') {
      const shouldClear = await confirm({ message: `Clear current offers for ${user.name}?`, default: false });
      if (!shouldClear) continue;

      await clearCurrentOffersForUser(user.id);
      console.log(`Current offers cleared for ${user.name}.`);
      continue;
    }

    const offers = await listCurrentOffersForUser(user.id);
    if (offers.length === 0) {
      console.log(`No current offers for ${user.name}. Run fetch first.`);
      continue;
    }

    for (const offer of offers) {
      console.log(`${offer.restaurantName} - ${offer.name} (${offer.quantity} szt.)`);
      console.log(`  ${formatPrice(offer.unitPrice)} / ${formatPrice(offer.originalPrice)} | odbior: ${formatPickup(offer.pickupFrom)} - ${formatPickup(offer.pickupTo)}`);
    }
  }
}

async function runOnce(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;
  await new WatcherService().runOnce(user);
}

async function watchUser(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;
  await scheduler.startForUser(user);
}

async function main(): Promise<void> {
  await initializeDatabase();
  const defaultInterval = await getDefaultWatchIntervalMinutes();
  console.log(`FoodAlert CLI started. Default interval: ${defaultInterval} min.`);

  while (true) {
    const action = await select<MainAction>({
      message: 'FoodAlert',
      choices: [
        { name: 'Users', value: 'users' },
        { name: 'Run once for user', value: 'run-once' },
        { name: 'Watch one user', value: 'watch-user' },
        { name: 'Watch all users', value: 'watch-all' },
        { name: 'Stop watchers', value: 'stop-watchers' },
        { name: 'Offers', value: 'offers' },
        { name: 'Restaurants', value: 'restaurants' },
        { name: 'Settings', value: 'settings' },
        { name: 'Exit', value: 'exit' },
      ],
    });

    switch (action) {
      case 'exit':
        console.log('Bye.');
        await shutdown(0);
      case 'users':
        await usersMenu();
        break;
      case 'run-once':
        await runOnce();
        break;
      case 'watch-user':
        await watchUser();
        break;
      case 'watch-all':
        await scheduler.startForAllUsers();
        break;
      case 'stop-watchers':
        scheduler.stop();
        console.log('Watchers stopped.');
        break;
      case 'offers':
        await offersMenu();
        break;
      case 'restaurants':
        await restaurantsMenu();
        break;
      case 'settings':
        await settingsMenu();
        break;
    }
  }
}

main().catch((error) => {
  if (error instanceof Error && error.name === 'ExitPromptError') {
    console.log('\nBye.');
    scheduler.stop();
    closeDatabase();
    return;
  }

  console.error(error);
  scheduler.stop();
  closeDatabase();
  process.exitCode = 1;
});
