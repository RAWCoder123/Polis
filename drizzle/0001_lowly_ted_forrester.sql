CREATE TABLE `write_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`allowed` integer NOT NULL,
	CONSTRAINT "write_allowed" CHECK("write_guards"."allowed"=1)
);
