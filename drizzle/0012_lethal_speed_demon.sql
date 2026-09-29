CREATE TABLE `community_news` (
	`communityId` text NOT NULL,
	`id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`domain` text NOT NULL,
	`publishedAt` text NOT NULL,
	`imageUrl` text,
	`summary` text,
	`origin` text NOT NULL,
	`sectionsJson` text DEFAULT '[]' NOT NULL,
	`importedAt` text NOT NULL,
	PRIMARY KEY(`communityId`, `id`)
);
--> statement-breakpoint
CREATE INDEX `community_news_recent` ON `community_news` (`communityId`,`publishedAt`);--> statement-breakpoint
CREATE TABLE `community_news_imports` (
	`communityId` text PRIMARY KEY NOT NULL,
	`importedAt` text NOT NULL,
	`articles` integer DEFAULT 0 NOT NULL
);
