PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_favorite_restaurants` (
	`user_id` integer NOT NULL,
	`restaurant_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_favorite_restaurants`("user_id", "restaurant_id", "created_at") SELECT "user_id", "restaurant_id", "created_at" FROM `user_favorite_restaurants`;--> statement-breakpoint
DROP TABLE `user_favorite_restaurants`;--> statement-breakpoint
ALTER TABLE `__new_user_favorite_restaurants` RENAME TO `user_favorite_restaurants`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_favorite_restaurants_idx` ON `user_favorite_restaurants` (`user_id`,`restaurant_id`);--> statement-breakpoint
CREATE TABLE `__new_user_ignored_restaurants` (
	`user_id` integer NOT NULL,
	`restaurant_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_ignored_restaurants`("user_id", "restaurant_id", "created_at") SELECT "user_id", "restaurant_id", "created_at" FROM `user_ignored_restaurants`;--> statement-breakpoint
DROP TABLE `user_ignored_restaurants`;--> statement-breakpoint
ALTER TABLE `__new_user_ignored_restaurants` RENAME TO `user_ignored_restaurants`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_ignored_restaurants_idx` ON `user_ignored_restaurants` (`user_id`,`restaurant_id`);--> statement-breakpoint
DROP TABLE `user_offer_states`;--> statement-breakpoint
CREATE TABLE `user_offer_states` (
	`user_id` integer NOT NULL,
	`offer_id` integer NOT NULL,
	`current_quantity` integer NOT NULL,
	`distance_km` real,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_offer_states_idx` ON `user_offer_states` (`user_id`,`offer_id`);--> statement-breakpoint
DELETE FROM `offers`;--> statement-breakpoint
ALTER TABLE `offers` DROP COLUMN `distance_km`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
