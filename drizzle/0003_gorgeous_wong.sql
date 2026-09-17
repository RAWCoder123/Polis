CREATE TABLE `community_events` (
	`id` text PRIMARY KEY NOT NULL,
	`seriesId` text NOT NULL,
	`communityId` text NOT NULL,
	`recordJson` text NOT NULL,
	`startsAt` text NOT NULL,
	`endsAt` text,
	`status` text NOT NULL,
	`createdBy` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`seriesId`) REFERENCES `event_series`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdBy`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_upcoming` ON `community_events` (`communityId`,`status`,`startsAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_series_occurrence` ON `community_events` (`seriesId`,`startsAt`);--> statement-breakpoint
CREATE TABLE `event_preferences` (
	`userId` text PRIMARY KEY NOT NULL,
	`city` text DEFAULT 'Ithaca' NOT NULL,
	`interestsJson` text DEFAULT '[]' NOT NULL,
	`complete` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event_series` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`sourceUrl` text NOT NULL,
	`note` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
