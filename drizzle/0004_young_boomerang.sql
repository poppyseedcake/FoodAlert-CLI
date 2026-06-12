ALTER TABLE `users` ADD `notify_re_stocked` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_stock_change` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_sold_out` integer DEFAULT true NOT NULL;
