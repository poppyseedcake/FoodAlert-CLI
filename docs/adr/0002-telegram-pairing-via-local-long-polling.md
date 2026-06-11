# Telegram pairing via local long polling

Telegram Connection pairing will be handled by the running CLI process using Telegram Bot API long polling instead of webhooks. This keeps local FoodAlert installations free from public HTTPS endpoint requirements, at the cost of pairing only being available while the CLI is running.
