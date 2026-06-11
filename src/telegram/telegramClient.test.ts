import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelegramBotClient } from './telegramClient.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TelegramBotClient', () => {
  it('includes Telegram API error descriptions in sendMessage failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: message is too long' }),
      { status: 400, statusText: 'Bad Request', headers: { 'Content-Type': 'application/json' } },
    )));

    const client = new TelegramBotClient('test-token');

    await expect(client.sendMessage('123456', 'too long')).rejects.toThrow(
      'Telegram sendMessage failed: 400 Bad Request: message is too long',
    );
  });
});
