type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: {
      id: number | string;
    };
  };
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

async function readTelegramResponse<T>(response: Response, method: string): Promise<TelegramApiResponse<T>> {
  let json: TelegramApiResponse<T> | null = null;
  try {
    json = (await response.json()) as TelegramApiResponse<T>;
  } catch {
    // Fall back to the HTTP status when Telegram does not return JSON.
  }

  if (!response.ok || !json?.ok) {
    const details = json?.description ?? response.statusText;
    throw new Error(`Telegram ${method} failed: ${response.status} ${details}`.trim());
  }

  return json;
}

export class TelegramBotClient {
  constructor(private readonly token: string) {}

  private get baseUrl(): string {
    return `https://api.telegram.org/bot${this.token}`;
  }

  async getUpdates(offset?: number, timeoutSeconds = 30): Promise<TelegramUpdate[]> {
    const params = new URLSearchParams();
    params.set('timeout', String(timeoutSeconds));
    if (offset !== undefined) {
      params.set('offset', String(offset));
    }

    const response = await fetch(`${this.baseUrl}/getUpdates?${params}`);
    const json = await readTelegramResponse<TelegramUpdate[]>(response, 'getUpdates');

    return json.result ?? [];
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    await readTelegramResponse<unknown>(response, 'sendMessage');
  }
}
