ALTER TABLE `users` ADD COLUMN `telegram_enabled` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `telegram_chat_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `telegram_pairing_code` text;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `console_notifications_enabled` integer NOT NULL DEFAULT 1;
