CREATE TABLE `patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version` integer NOT NULL,
	`stitch` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`cells` blob NOT NULL,
	`legend` text NOT NULL,
	`totals` text NOT NULL,
	`bead_spec` text NOT NULL,
	`settings` text NOT NULL,
	`guide_key` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patterns_project_version_idx` ON `patterns` (`project_id`,`version`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`browser_id` text NOT NULL,
	`title` text NOT NULL,
	`original_key` text NOT NULL,
	`working_key` text NOT NULL,
	`thumb_key` text NOT NULL,
	`working_width` integer NOT NULL,
	`working_height` integer NOT NULL,
	`settings` text NOT NULL,
	`created_at` text NOT NULL,
	`last_accessed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_browser_idx` ON `projects` (`browser_id`);--> statement-breakpoint
CREATE INDEX `projects_last_accessed_idx` ON `projects` (`last_accessed_at`);