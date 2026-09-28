CREATE TABLE `community_memberships` (
	`userId` text NOT NULL,
	`communityId` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	PRIMARY KEY(`userId`, `communityId`),
	FOREIGN KEY (`userId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitation_redemptions` (
	`codeId` text NOT NULL,
	`userId` text NOT NULL,
	`requestKey` text NOT NULL,
	`redeemedAt` text NOT NULL,
	PRIMARY KEY(`codeId`, `userId`),
	FOREIGN KEY (`codeId`) REFERENCES `invitation_codes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `invitation_codes` ADD `communityId` text DEFAULT 'ithaca' NOT NULL;--> statement-breakpoint
ALTER TABLE `invitation_codes` ADD `unlimited` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `activeCommunityId` text DEFAULT 'ithaca' NOT NULL;--> statement-breakpoint
CREATE VIEW `pilot_memberships` AS SELECT userId,communityId,role FROM memberships UNION ALL SELECT c.userId,c.communityId,c.role FROM community_memberships c WHERE NOT EXISTS(SELECT 1 FROM memberships m WHERE m.userId=c.userId AND m.communityId=c.communityId);