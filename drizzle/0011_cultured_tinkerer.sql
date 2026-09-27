CREATE TABLE `community_places` (
	`communityId` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`subtitle` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`source` text NOT NULL,
	`sourceRef` text NOT NULL,
	`website` text,
	`importedAt` text NOT NULL,
	PRIMARY KEY(`communityId`, `id`)
);
--> statement-breakpoint
CREATE TABLE `place_communities` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`locationLabel` text NOT NULL,
	`city` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`timezone` text NOT NULL,
	`domain` text,
	`university` text,
	`createdBy` text NOT NULL,
	`createdAt` text NOT NULL,
	`placesImportedAt` text,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_community_domain` ON `place_communities` (`domain`);--> statement-breakpoint
CREATE INDEX `place_community_city` ON `place_communities` (`country`,`region`,`city`);