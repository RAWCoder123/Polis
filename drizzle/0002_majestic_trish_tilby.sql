CREATE TABLE `issue_priorities` (
	`userId` text NOT NULL,
	`issueId` text NOT NULL,
	`priority` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`userId`, `issueId`),
	FOREIGN KEY (`userId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `onboardingComplete` integer DEFAULT 0 NOT NULL;