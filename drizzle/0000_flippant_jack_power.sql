CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`default_watch_interval_minutes` integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`restaurant_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`current_quantity` integer NOT NULL,
	`unit_price` real,
	`original_price` real,
	`pickup_from` text,
	`pickup_to` text,
	`distance_km` real,
	`last_seen_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_provider_external_id_idx` ON `offers` (`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`address` text,
	`last_seen_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_provider_external_id_idx` ON `restaurants` (`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `user_favorite_restaurants` (
	`user_id` integer NOT NULL,
	`restaurant_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_favorite_restaurants_idx` ON `user_favorite_restaurants` (`user_id`,`restaurant_id`);--> statement-breakpoint
CREATE TABLE `user_ignored_restaurants` (
	`user_id` integer NOT NULL,
	`restaurant_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_ignored_restaurants_idx` ON `user_ignored_restaurants` (`user_id`,`restaurant_id`);--> statement-breakpoint
CREATE TABLE `user_offer_states` (
	`user_id` integer NOT NULL,
	`offer_id` integer NOT NULL,
	`current_quantity` integer NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_offer_states_idx` ON `user_offer_states` (`user_id`,`offer_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`foodsi_email` text NOT NULL,
	`foodsi_password` text NOT NULL,
	`notify_only_favorites` integer DEFAULT false NOT NULL,
	`watch_interval_minutes` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
