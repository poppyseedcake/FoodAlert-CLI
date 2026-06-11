type TelegramChat = {
  id: number | string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type TelegramClient = {
  getUpdates(offset?: number, timeoutSeconds?: number): Promise<TelegramUpdate[]>;
  sendMessage(chatId: string, text: string): Promise<void>;
};

type TelegramPairingRepository = {
  findUserByTelegramPairingCode(code: string): Promise<{ id: number; name: string; telegramChatId: string | null } | null>;
  setTelegramChatId(userId: number, chatId: string | null): Promise<void>;
  setTelegramEnabled(userId: number, enabled: boolean): Promise<void>;
  setTelegramPairingCode(userId: number, code: string | null): Promise<void>;
};

export class TelegramPairingService {
  private offset: number | undefined;

  constructor(
    private readonly client: TelegramClient,
    private readonly repository: TelegramPairingRepository,
  ) {}

  async pollOnce(): Promise<void> {
    const updates = await this.client.getUpdates(this.offset, 30);

    for (const update of updates) {
      this.offset = Math.max(this.offset ?? 0, update.update_id + 1);
      await this.handleUpdate(update);
    }
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text?.startsWith('/start')) {
      return;
    }

    const [, code = ''] = message.text.trim().split(/\s+/, 2);
    if (!code) {
      await this.client.sendMessage(String(message.chat.id), 'Send /start <pairing-code> to connect this chat.');
      return;
    }

    const user = await this.repository.findUserByTelegramPairingCode(code);
    if (!user) {
      await this.client.sendMessage(String(message.chat.id), 'Unknown pairing code.');
      return;
    }

    const chatId = String(message.chat.id);
    await this.repository.setTelegramChatId(user.id, chatId);
    await this.repository.setTelegramEnabled(user.id, true);
    await this.repository.setTelegramPairingCode(user.id, null);
    await this.client.sendMessage(chatId, `Telegram connected for ${user.name}.`);
  }
}
