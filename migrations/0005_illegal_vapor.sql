ALTER TABLE `users` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone_number` text;--> statement-breakpoint
CREATE INDEX `users_external_id_idx` ON `users` (`external_id`);--> statement-breakpoint
CREATE INDEX `users_phone_number_idx` ON `users` (`phone_number`);