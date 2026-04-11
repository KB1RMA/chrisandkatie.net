CREATE TABLE `GuestPhoto` (
	`id` text PRIMARY KEY NOT NULL,
	`r2Key` text NOT NULL,
	`publicUrl` text NOT NULL,
	`guestId` text NOT NULL,
	`eventId` text,
	`status` text DEFAULT 'visible' NOT NULL,
	`width` integer,
	`height` integer,
	`takenAt` text,
	`uploadedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`removedAt` text,
	`removedBy` text,
	FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `GuestPhoto_status_uploadedAt_idx` ON `GuestPhoto` (`status`,`uploadedAt`);--> statement-breakpoint
CREATE INDEX `GuestPhoto_guestId_idx` ON `GuestPhoto` (`guestId`);--> statement-breakpoint
CREATE INDEX `GuestPhoto_eventId_idx` ON `GuestPhoto` (`eventId`);
