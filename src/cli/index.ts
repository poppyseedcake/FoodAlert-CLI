import { confirm, select } from '@inquirer/prompts';
import { initializeDatabase } from '../db/client.js';
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
import { promptMinutes, promptNewUser, selectRestaurant, selectUser } from './prompts.js';

type MainAction =
  | 'users'
  | 'run-once'
  | 'watch-user'
  | 'watch-all'
  | 'offers'
  | 'restaurants'
  | 'settings'
  | 'exit';

function formatPickup(date: Date | null): string {
  if (!date) return '?';
  return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatPrice(value: number | null): string {
  return value === null ? '?' : `${value} PLN`;
}

async function usersMenu(): Promise<void> {
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

async function settingsMenu(): Promise<void> {
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
    return;
  }

  const user = await selectUser(await listUsers());
  if (!user) return;

  if (action === 'user') {
    const minutes = await promptMinutes('User interval in minutes');
    await setUserWatchInterval(user.id, minutes);
    console.log(`User interval set to ${minutes} min.`);
  } else if (action === 'clear-user') {
    await setUserWatchInterval(user.id, null);
    console.log('User interval cleared.');
  } else {
    const enabled = await confirm({ message: 'Notify only about favorite restaurants?', default: user.notifyOnlyFavorites });
    await setNotifyOnlyFavorites(user.id, enabled);
    console.log(`Only favorites: ${enabled}.`);
  }
}

async function chooseRestaurantSource(userId: number) {
  const source = await select({
    message: 'Restaurant source',
    choices: [
      { name: 'Current offers', value: 'current' },
      { name: 'Recently seen restaurants', value: 'recent' },
      { name: 'Back', value: 'back' },
    ],
  });

  if (source === 'back') return [];
  return source === 'current' ? listRestaurantsFromCurrentOffers(userId) : listRecentlySeenRestaurants();
}

async function restaurantsMenu(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;

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
    return;
  }

  const restaurants =
    action === 'remove-favorite'
      ? await getRestaurantsByIds(await listFavoriteRestaurantIds(user.id))
      : action === 'remove-ignored'
        ? await getRestaurantsByIds(await listIgnoredRestaurantIds(user.id))
        : await chooseRestaurantSource(user.id);

  const restaurant = await selectRestaurant(restaurants);
  if (!restaurant?.id) return;

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

async function offersMenu(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;

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
    if (!shouldClear) return;

    await clearCurrentOffersForUser(user.id);
    console.log(`Current offers cleared for ${user.name}.`);
    return;
  }

  const offers = await listCurrentOffersForUser(user.id);
  if (offers.length === 0) {
    console.log(`No current offers for ${user.name}. Run fetch first.`);
    return;
  }

  for (const offer of offers) {
    console.log(`${offer.restaurantName} - ${offer.name} (${offer.quantity} szt.)`);
    console.log(`  ${formatPrice(offer.unitPrice)} / ${formatPrice(offer.originalPrice)} | odbior: ${formatPickup(offer.pickupFrom)} - ${formatPickup(offer.pickupTo)}`);
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
  await new SchedulerService().startForUser(user);
}

async function main(): Promise<void> {
  initializeDatabase();
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
        { name: 'Offers', value: 'offers' },
        { name: 'Restaurants', value: 'restaurants' },
        { name: 'Settings', value: 'settings' },
        { name: 'Exit', value: 'exit' },
      ],
    });

    switch (action) {
      case 'exit':
        console.log('Bye.');
        process.exit(0);
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
        await new SchedulerService().startForAllUsers();
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
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
