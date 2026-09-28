CREATE TABLE `invitation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`tokenHash` text NOT NULL,
	`createdBy` text NOT NULL,
	`createdAt` text NOT NULL,
	`expiresAt` text NOT NULL,
	`maxUses` integer NOT NULL,
	`useCount` integer DEFAULT 0 NOT NULL,
	`revokedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_codes_tokenHash_unique` ON `invitation_codes` (`tokenHash`);