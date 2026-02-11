PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`username` text,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`bio` text,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`email_verified` integer DEFAULT false,
	`password_hash` text,
	`phone` text,
	`external_id` text,
	`failed_login_attempts` integer DEFAULT 0,
	`locked_until` integer,
	`password_changed_at` integer,
	`preferences` text DEFAULT '{}',
	`theme` text DEFAULT 'system',
	`timezone` text DEFAULT 'UTC',
	`is_active` integer DEFAULT true,
	`is_suspended` integer DEFAULT false,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	`last_active_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "username", "display_name", "avatar_url", "bio", "provider", "provider_id", "email_verified", "password_hash", "phone", "external_id", "failed_login_attempts", "locked_until", "password_changed_at", "preferences", "theme", "timezone", "is_active", "is_suspended", "created_at", "updated_at", "last_active_at", "deleted_at") SELECT "id", "email", "username", "display_name", "avatar_url", "bio", "provider", "provider_id", "email_verified", "password_hash", "phone", "external_id", "failed_login_attempts", "locked_until", "password_changed_at", "preferences", "theme", "timezone", "is_active", "is_suspended", "created_at", "updated_at", "last_active_at", "deleted_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_external_id_unique` ON `users` (`external_id`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_unique_idx` ON `users` (`provider`,`provider_id`);--> statement-breakpoint
CREATE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `users_failed_login_attempts_idx` ON `users` (`failed_login_attempts`);--> statement-breakpoint
CREATE INDEX `users_locked_until_idx` ON `users` (`locked_until`);--> statement-breakpoint
CREATE INDEX `users_is_active_idx` ON `users` (`is_active`);--> statement-breakpoint
CREATE INDEX `users_last_active_at_idx` ON `users` (`last_active_at`);