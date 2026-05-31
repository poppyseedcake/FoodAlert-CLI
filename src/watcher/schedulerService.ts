import { getDefaultWatchIntervalMinutes, listUsers } from '../users/userRepository.js';
import type { UserProfile } from '../domain/types.js';
import { WatcherService } from './watcherService.js';

const JITTER_MS = 30_000;
const MIN_DELAY_MS = 30_000;

export function calculateNextDelayMs(intervalMinutes: number, random = Math.random): number {
  const baseDelay = intervalMinutes * 60_000;
  const jitter = Math.floor((random() * 2 - 1) * JITTER_MS);
  return Math.max(MIN_DELAY_MS, baseDelay + jitter);
}

export class SchedulerService {
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(private readonly watcher = new WatcherService()) {}

  async startForUser(user: UserProfile): Promise<void> {
    const defaultInterval = await getDefaultWatchIntervalMinutes();
    const intervalMinutes = user.watchIntervalMinutes ?? defaultInterval;

    const run = async () => {
      try {
        await this.watcher.runOnce(user);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${user.name}] Error: ${message}`);
      } finally {
        const delay = calculateNextDelayMs(intervalMinutes);
        console.log(`[${user.name}] Next check in ${Math.round(delay / 1000)}s.`);
        const timer = setTimeout(run, delay);
        this.timers.add(timer);
      }
    };

    await run();
  }

  async startForAllUsers(): Promise<void> {
    const users = await listUsers();
    if (users.length === 0) {
      console.log('No users found. Add a user first.');
      return;
    }

    await Promise.all(users.map((user) => this.startForUser(user)));
  }

  stop(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
