CREATE TABLE `answers` (
	`userId` text NOT NULL,
	`questionId` text NOT NULL,
	`choice` text NOT NULL,
	`note` text NOT NULL,
	`audience` text DEFAULT 'only_me' NOT NULL,
	PRIMARY KEY(`userId`, `questionId`)
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`ownerId` text NOT NULL,
	`targetId` text NOT NULL,
	PRIMARY KEY(`ownerId`, `targetId`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`postId` text NOT NULL,
	`authorId` text NOT NULL,
	`parentId` text,
	`text` text NOT NULL,
	`createdAt` text NOT NULL,
	`editedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`authorId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comments_post` ON `comments` (`postId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `follows` (
	`userId` text NOT NULL,
	`issueId` text NOT NULL,
	`notify` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`userId`, `issueId`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`a` text NOT NULL,
	`b` text NOT NULL,
	`requester` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_pair` ON `friendships` (`a`,`b`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`tokenHash` text NOT NULL,
	`createdBy` text NOT NULL,
	`expiresAt` text NOT NULL,
	`usedBy` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_tokenHash_unique` ON `invitations` (`tokenHash`);--> statement-breakpoint
CREATE TABLE `issue_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`issueId` text NOT NULL,
	`title` text NOT NULL,
	`sourceUrl` text NOT NULL,
	`sample` integer NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`postId` text NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`itemsJson` text NOT NULL,
	FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lists_postId_unique` ON `lists` (`postId`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`userId` text PRIMARY KEY NOT NULL,
	`communityId` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`event` text NOT NULL,
	`objectId` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mutes` (
	`ownerId` text NOT NULL,
	`targetId` text NOT NULL,
	PRIMARY KEY(`ownerId`, `targetId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`actorId` text NOT NULL,
	`kind` text NOT NULL,
	`targetId` text NOT NULL,
	`commentId` text,
	`createdAt` text NOT NULL,
	`readAt` text
);
--> statement-breakpoint
CREATE INDEX `notification_inbox` ON `notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `plans` (
	`userId` text NOT NULL,
	`eventId` text NOT NULL,
	`status` text NOT NULL,
	`audience` text DEFAULT 'only_me' NOT NULL,
	PRIMARY KEY(`userId`, `eventId`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`authorId` text NOT NULL,
	`communityId` text NOT NULL,
	`kind` text NOT NULL,
	`subjectId` text NOT NULL,
	`issueId` text NOT NULL,
	`position` text,
	`text` text NOT NULL,
	`audience` text NOT NULL,
	`attachmentJson` text DEFAULT '{}' NOT NULL,
	`priorPostId` text,
	`createdAt` text NOT NULL,
	`editedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`authorId`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `posts_feed` ON `posts` (`communityId`,`createdAt`,`id`);--> statement-breakpoint
CREATE TABLE `preferences` (
	`userId` text PRIMARY KEY NOT NULL,
	`replies` integer DEFAULT 1 NOT NULL,
	`reactions` integer DEFAULT 1 NOT NULL,
	`issues` integer DEFAULT 1 NOT NULL,
	`events` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`communityLabel` text DEFAULT 'Ithaca, NY' NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`issueId` text NOT NULL,
	`title` text NOT NULL,
	`background` text NOT NULL,
	`sourceUrl` text NOT NULL,
	`sample` integer DEFAULT 1 NOT NULL,
	`optionsJson` text NOT NULL,
	`startsAt` text NOT NULL,
	`endsAt` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rankings` (
	`userId` text NOT NULL,
	`itemId` text NOT NULL,
	`score` real NOT NULL,
	`note` text NOT NULL,
	`priority` integer NOT NULL,
	`position` text,
	PRIMARY KEY(`userId`, `itemId`)
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`userId` text NOT NULL,
	`postId` text NOT NULL,
	`kind` text NOT NULL,
	PRIMARY KEY(`userId`, `postId`),
	FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporterId` text NOT NULL,
	`targetId` text NOT NULL,
	`reason` text NOT NULL,
	`evidence` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`fingerprint` text NOT NULL,
	`resultJson` text NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saves` (
	`userId` text NOT NULL,
	`targetId` text NOT NULL,
	PRIMARY KEY(`userId`, `targetId`)
);
