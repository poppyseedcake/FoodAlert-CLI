import { describe, expect, it, vi } from 'vitest';
import { TelegramPairingService } from './telegramPairingService.js';

describe('TelegramPairingService', () => {
  it('binds a Telegram chat to the matching profile when /start code arrives', async () => {
    const findUserByTelegramPairingCode = vi.fn(async (code: string) =>
      code === 'pair-123' ? { id: 7, name: 'Woj', telegramChatId: null } : null,
    );
    const setTelegramChatId = vi.fn(async () => undefined);
    const setTelegramEnabled = vi.fn(async () => undefined);
    const setTelegramPairingCode = vi.fn(async () => undefined);
    const sendMessage = vi.fn(async () => undefined);

    const service = new TelegramPairingService({
      getUpdates: vi.fn(async () => [
        {
          update_id: 11,
          message: {
            message_id: 1,
            text: '/start pair-123',
            chat: { id: 123456 },
          },
        },
      ]),
      sendMessage,
    } as never, {
      findUserByTelegramPairingCode,
      setTelegramChatId,
      setTelegramEnabled,
      setTelegramPairingCode,
    });

    await service.pollOnce();

    expect(findUserByTelegramPairingCode).toHaveBeenCalledWith('pair-123');
    expect(setTelegramChatId).toHaveBeenCalledWith(7, '123456');
    expect(setTelegramEnabled).toHaveBeenCalledWith(7, true);
    expect(setTelegramPairingCode).toHaveBeenCalledWith(7, null);
    expect(sendMessage).toHaveBeenCalledWith('123456', expect.stringContaining('Telegram connected'));
  });
});
