CREATE TABLE `organization_memberships` (
	`userId` text NOT NULL,
	`organizationId` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	PRIMARY KEY(`userId`, `organizationId`),
	FOREIGN KEY (`userId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `invitation_codes` ADD `organizationId` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `organizationId` text;