import type { AlertEvent } from '../domain/types.js';
import { formatAlertPresentation } from '../notifications/offerPresentation.js';

const TELEGRAM_MESSAGE_MAX_LENGTH = 4096;

type TelegramMessageSender = {
  sendMessage(chatId: string, text: string): Promise<void>;
};

function hardSplit(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let end = maxLength;
    const lastCodeUnit = remaining.charCodeAt(end - 1);
    if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
      end -= 1;
    }
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }
  return parts;
}

export function splitTelegramMessage(text: string, maxLength = TELEGRAM_MESSAGE_MAX_LENGTH): string[] {
  const blocks = text.split('\n\n').flatMap((block) => hardSplit(block, maxLength));
  const messages: string[] = [];
  let current = '';

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current) {
      messages.push(current);
    }
    current = block;
  }

  if (current) {
    messages.push(current);
  }
  return messages;
}

export class TelegramNotifier {
  constructor(private readonly client: TelegramMessageSender) {}

  async notifyAlerts(
    user: { id: number; name: string; telegramChatId: string | null },
    events: AlertEvent[],
  ): Promise<void> {
    if (events.length === 0 || !user.telegramChatId) {
      return;
    }

    const presentation = formatAlertPresentation(user, events);
    for (const message of splitTelegramMessage(presentation)) {
      await this.client.sendMessage(user.telegramChatId, message);
    }
  }
}
