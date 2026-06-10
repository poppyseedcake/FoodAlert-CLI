import type { AlertEvent, OfferInput, UserDisplay } from '../domain/types.js';
import { formatAlertPresentation, formatCurrentOfferPresentation } from './offerPresentation.js';

export class ConsoleNotifier {
  showCurrentOffers(user: UserDisplay, offers: OfferInput[]): void {
    console.log(formatCurrentOfferPresentation(user, offers));
  }

  notifyAlerts(user: UserDisplay, events: AlertEvent[]): void {
    if (events.length > 0) {
      console.log(formatAlertPresentation(user, events));
    }
  }

  info(user: UserDisplay, message: string): void {
    console.log(`[${user.name}] ${message}`);
  }

  error(user: UserDisplay, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${user.name}] Error: ${message}`);
  }
}
