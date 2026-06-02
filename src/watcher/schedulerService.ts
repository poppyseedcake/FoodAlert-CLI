import { getDefaultWatchIntervalMinutes, listUsers } from '../users/userRepository.js';
import type { UserProfile } from '../domain/types.js';
import { WatcherService } from './watcherService.js';
import { calculateNextDelayMs } from './schedulerTiming.js';

export type SchedulerStatusEntry = {
  userId: number;
  name: string;
  watching: boolean;
  nextRunAt: Date | null;
};

/**
 * Scheduler for periodic Foodsi fetches.
 *
 * Concurrency model: each user has an independent timer. The "generation" counter is
 * incremented on every startForUser / stopForUser call, and the in-flight callback checks
 * its captured generation before scheduling the next tick. This way, if you restart a
 * watcher while a previous runOnce is still in flight, the old callback's setTimeout is
 * a no-op (the new generation took over).
 */
export class SchedulerService {
  private readonly timers = new Map<number, NodeJS.Timeout>();
  private readonly generations = new Map<number, number>();
  private readonly nextRunAt = new Map<number, number>();
  private readonly names = new Map<number, string>();

  constructor(private readonly watcher = new WatcherService()) {}

  async startForUser(user: UserProfile): Promise<void> {
    this.stopForUser(user.id);
    const generation = (this.generations.get(user.id) ?? 0) + 1;
    this.generations.set(user.id, generation);
    this.names.set(user.id, user.name);

    const defaultInterval = await getDefaultWatchIntervalMinutes();
    const intervalMinutes = user.watchIntervalMinutes ?? defaultInterval;

    const run = async () => {
      try {
        await this.watcher.runOnce(user);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${user.name}] Error: ${message}`);
      } finally {
        if (this.generations.get(user.id) !== generation) {
          return;
        }

        const delay = calculateNextDelayMs(intervalMinutes);
        const nextAt = Date.now() + delay;
        this.nextRunAt.set(user.id, nextAt);
        console.log(`[${user.name}] Next check in ${Math.round(delay / 1000)}s.`);
        const timer = setTimeout(run, delay);
        this.timers.set(user.id, timer);
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

  stopForUser(userId: number): void {
    this.forgetUser(userId, false);
  }

  forgetUser(userId: number, removeName = true): void {
    const generation = this.generations.get(userId);
    if (generation !== undefined) {
      this.generations.set(userId, generation + 1);
    }

    const timer = this.timers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(userId);
    }
    this.nextRunAt.delete(userId);
    if (removeName) {
      this.names.delete(userId);
    }
  }

  stop(): void {
    for (const [userId, generation] of this.generations) {
      this.generations.set(userId, generation + 1);
    }

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.nextRunAt.clear();
  }

  getStatus(): SchedulerStatusEntry[] {
    return Array.from(this.names.entries()).map(([userId, name]) => {
      const nextAt = this.nextRunAt.get(userId);
      return {
        userId,
        name,
        watching: this.timers.has(userId),
        nextRunAt: nextAt ? new Date(nextAt) : null,
      };
    });
  }
}
