ALTER TABLE `event_suggestions` ADD `communityId` text DEFAULT 'ithaca' NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `communityId` text DEFAULT 'ithaca' NOT NULL;