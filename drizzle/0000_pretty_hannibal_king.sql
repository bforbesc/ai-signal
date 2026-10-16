CREATE TABLE `gmail_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`encrypted` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gmail_oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
