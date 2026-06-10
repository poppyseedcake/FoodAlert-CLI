import { confirm, select } from '@inquirer/prompts';
import type { Restaurant, UserProfile } from '../domain/types.js';
import { providerIdentityLabel } from '../domain/providerIdentity.js';
import { closeDatabase, initializeDatabase } from '../db/client.js';
import {
  createUser,
  getDefaultWatchIntervalMinutes,
  listUsers,
  setDefaultWatchIntervalMinutes,
  setNotifyOnlyFavorites,
  setUserWatchInterval,
} from '../users/userRepository.js';
import { clearCurrentOffersForUser, listCurrentOffersForUser } from '../offers/offerRepository.js';
import { SchedulerService } from '../watcher/schedulerService.js';
import { WatcherService } from '../watcher/watcherService.js';
import { ConsoleNotifier } from '../notifications/consoleNotifier.js';
import { promptMinutes, promptNewUser, selectRestaurants, selectUser } from './prompts.js';
import { cliWorkflows, restaurantListLabel, type RestaurantListKind, type RestaurantSource } from './workflows.js';
import { formatUserListEntry } from './userListFormat.js';

type MainAction =
  | 'users'
  | 'run-once'
  | 'watch-user'
  | 'watch-all'
  | 'stop-watchers'
  | 'status'
  | 'offers'
  | 'restaurants'
  | 'settings'
  | 'exit';

const scheduler = new SchedulerService();
const consoleNotifier = new ConsoleNotifier();
let isShuttingDown = false;
//
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
        { name: 'Delete user', value: 'delete-user' },
        { name: 'Back', value: 'back' },
      ],
    });

    if (action === 'back') return;

    if (action === 'add-user') {
      const user = await createUser(await promptNewUser());
      console.log(`Created user ${user.name}.`);
    } else if (action === 'delete-user') {
      const user = await selectUser(await listUsers());
      if (!user) continue;
      const confirmed = await confirm({
        message: `Delete user "${user.name}"? All favorites, ignored lists, and offer states will be removed.`,
        default: false,
      });
      if (!confirmed) continue;
      await cliWorkflows.deleteUserProfile(user.id, scheduler);
      console.log(`Deleted user ${user.name}.`);
    } else {
      const users = await listUsers();
      users.forEach((user, index) => console.log(formatUserListEntry(index, user)));
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

async function pickRestaurantSource(): Promise<RestaurantSource | null> {
  const source = await select<RestaurantPickerSource>({
    message: 'Restaurant source',
    choices: [
      { name: 'Current offers', value: 'current' },
      { name: 'Recently seen restaurants', value: 'recent' },
      { name: 'Back', value: 'back' },
    ],
  });

  if (source === 'back') return null;
  return source;
}

type RestaurantPickerSource = RestaurantSource | 'back';
type ListAction = 'show' | 'add' | 'remove' | 'back';
type ListPickerAction = RestaurantListKind | 'back';

function printRestaurants(restaurants: Restaurant[]): void {
  for (const restaurant of restaurants) {
    console.log(`${restaurant.id}. ${restaurant.name} ${providerIdentityLabel(restaurant)}`);
  }
}

async function listPickerMenu(user: UserProfile, kind: RestaurantListKind): Promise<void> {
  const label = restaurantListLabel(kind);

  while (true) {
    const action = await select<ListAction>({
      message: `${label[0].toUpperCase()}${label.slice(1)} for ${user.name}`,
      choices: [
        { name: `Show ${label}`, value: 'show' },
        { name: `Add to ${label}`, value: 'add' },
        { name: `Remove from ${label}`, value: 'remove' },
        { name: 'Back', value: 'back' },
      ],
    });

    if (action === 'back') return;

    if (action === 'show') {
      const restaurants = await cliWorkflows.listRestaurants(user.id, kind);
      if (restaurants.length === 0) {
        console.log(`No ${label} for ${user.name}.`);
      } else {
        printRestaurants(restaurants);
      }
      continue;
    }

    if (action === 'add') {
      const source = await pickRestaurantSource();
      if (source === null) continue;

      const candidates = await cliWorkflows.listAddableRestaurants(user.id, kind, source);
      if (candidates.length === 0) {
        console.log(`No new restaurants to add to ${label}.`);
        continue;
      }

      const picked = await selectRestaurants(candidates, `Select restaurants to add to ${label} (space to toggle, enter to confirm)`);
      if (picked.length === 0) {
        console.log('No restaurants selected.');
        continue;
      }

      const ids = picked.map((restaurant) => restaurant.id);
      await cliWorkflows.addRestaurants(user.id, kind, ids);
      console.log(`Added ${picked.length} restaurant(s) to ${label}.`);
      continue;
    }

    const restaurants = await cliWorkflows.listRestaurants(user.id, kind);
    if (restaurants.length === 0) {
      console.log(`No ${label} to remove for ${user.name}.`);
      continue;
    }

    const picked = await selectRestaurants(restaurants, `Select restaurants to remove from ${label} (space to toggle, enter to confirm)`);
    if (picked.length === 0) {
      console.log('No restaurants selected.');
      continue;
    }

    const pickedIds = picked.map((restaurant) => restaurant.id);
    await cliWorkflows.removeRestaurants(user.id, kind, pickedIds);
    console.log(`Removed ${picked.length} restaurant(s) from ${label}.`);
  }
}

async function restaurantsMenu(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;

  while (true) {
    const action = await select<ListPickerAction>({
      message: `Restaurants (${user.name})`,
      choices: [
        { name: 'Manage favorites', value: 'favorites' },
        { name: 'Manage ignored', value: 'ignored' },
        { name: 'Back', value: 'back' },
      ],
    });

    if (action === 'back') return;
    await listPickerMenu(user, action);
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

    consoleNotifier.showCurrentOffers(user, offers);
  }
}

async function runOnce(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;

  try {
    await new WatcherService().runOnce(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${user.name}] Error: ${message}`);
  }
}

async function watchUser(): Promise<void> {
  const user = await selectUser(await listUsers());
  if (!user) return;
  await scheduler.startForUser(user);
}

function printStatus(): void {
  const entries = scheduler.getStatus();
  if (entries.length === 0) {
    console.log('No users registered.');
    return;
  }
  for (const entry of entries) {
    const state = entry.watching ? 'watching' : 'idle';
    const next = entry.nextRunAt
      ? `next check at ${entry.nextRunAt.toLocaleString('pl-PL')}`
      : 'no scheduled check';
    console.log(`${entry.userId}. ${entry.name} [${state}] — ${next}`);
  }
}

async function main(): Promise<void> {
  await initializeDatabase();
  const defaultInterval = await getDefaultWatchIntervalMinutes();
  console.log(`FoodAlert - CLI started. Default interval: ${defaultInterval} min.`);

  while (true) {
    const action = await select<MainAction>({
      message: 'FoodAlert - CLI',
      choices: [
        { name: 'Users', value: 'users' },
        { name: 'Run once for user', value: 'run-once' },
        { name: 'Watch one user', value: 'watch-user' },
        { name: 'Watch all users', value: 'watch-all' },
        { name: 'Stop watchers', value: 'stop-watchers' },
        { name: 'Status', value: 'status' },
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
        break;
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
      case 'status':
        printStatus();
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
