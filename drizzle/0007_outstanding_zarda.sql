CREATE TABLE `conversation_follows` (
	`userId` text NOT NULL,
	`postId` text NOT NULL,
	PRIMARY KEY(`userId`, `postId`),
	FOREIGN KEY (`userId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `issue_updates` ADD `communityId` text DEFAULT 'ithaca' NOT NULL;--> statement-breakpoint
ALTER TABLE `metrics` ADD `communityId` text DEFAULT 'ithaca' NOT NULL;