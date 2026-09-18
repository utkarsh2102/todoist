CREATE TABLE `activity_log` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` integer NOT NULL,
	`actor_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`type` text NOT NULL,
	`data_json` text,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_entity` ON `activity_log` (`entity_type`,`entity_id`,`seq`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "categories_position" CHECK("categories"."position" BETWEEN 0 AND 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_position_unique` ON `categories` (`position`);--> statement-breakpoint
CREATE TABLE `job_runs` (
	`name` text PRIMARY KEY NOT NULL,
	`last_started_at` integer,
	`last_success_at` integer,
	`last_boundary` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`title` text NOT NULL,
	`description_md` text DEFAULT '' NOT NULL,
	`priority` text,
	`due_date` text,
	`due_time` text,
	`duration_min` integer,
	`assignee_id` text,
	`links_json` text DEFAULT '[]' NOT NULL,
	`completed_at` integer,
	`completed_by` text,
	`resolution` text,
	`archived_at` integer,
	`deleted_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tasks_title" CHECK(length("tasks"."title") BETWEEN 1 AND 300),
	CONSTRAINT "tasks_priority" CHECK("tasks"."priority" IS NULL OR "tasks"."priority" IN ('P0', 'P1', 'P2', 'P3', 'P4', 'WISH')),
	CONSTRAINT "tasks_due_date" CHECK("tasks"."due_date" IS NULL OR "tasks"."due_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "tasks_due_time" CHECK("tasks"."due_time" IS NULL OR ("tasks"."due_date" IS NOT NULL AND "tasks"."due_time" GLOB '[0-2][0-9]:[0-5][0-9]')),
	CONSTRAINT "tasks_duration" CHECK("tasks"."duration_min" IS NULL OR "tasks"."duration_min" BETWEEN 1 AND 1440),
	CONSTRAINT "tasks_resolution" CHECK(("tasks"."completed_at" IS NULL AND "tasks"."resolution" IS NULL) OR ("tasks"."completed_at" IS NOT NULL AND "tasks"."resolution" IS NOT NULL AND "tasks"."resolution" IN ('done', 'skipped'))),
	CONSTRAINT "tasks_archived_requires_completed" CHECK("tasks"."archived_at" IS NULL OR "tasks"."completed_at" IS NOT NULL),
	CONSTRAINT "tasks_links_json" CHECK(json_valid("tasks"."links_json") AND json_type("tasks"."links_json") = 'array'),
	CONSTRAINT "tasks_version" CHECK("tasks"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `tasks_board` ON `tasks` (`category_id`,`archived_at`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `tasks_assignee` ON `tasks` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `tasks_sweep` ON `tasks` (`completed_at`) WHERE "tasks"."archived_at" IS NULL;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`google_sub` text,
	`name` text NOT NULL,
	`avatar_url` text,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`timezone` text NOT NULL,
	`default_reminder_time` text DEFAULT '09:00' NOT NULL,
	`notify_hide_content` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer,
	CONSTRAINT "users_role" CHECK("users"."role" IN ('owner', 'editor', 'viewer')),
	CONSTRAINT "users_status" CHECK("users"."status" IN ('invited', 'active', 'disabled')),
	CONSTRAINT "users_email_lowercase" CHECK("users"."email" = lower("users"."email")),
	CONSTRAINT "users_reminder_time" CHECK("users"."default_reminder_time" GLOB '[0-2][0-9]:[0-5][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);