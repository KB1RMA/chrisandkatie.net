CREATE TABLE `SeatingAssignment` (
	`id` text PRIMARY KEY NOT NULL,
	`tableId` text NOT NULL,
	`guestId` text NOT NULL,
	`seatOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tableId`) REFERENCES `SeatingTable`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SeatingAssignment_guestId_key` ON `SeatingAssignment` (`guestId`);--> statement-breakpoint
CREATE INDEX `SeatingAssignment_tableId_idx` ON `SeatingAssignment` (`tableId`);--> statement-breakpoint
CREATE TABLE `SeatingTable` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer DEFAULT 8 NOT NULL,
	`isHeadTable` integer DEFAULT false NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `SeatingTable_eventId_idx` ON `SeatingTable` (`eventId`);--> statement-breakpoint
CREATE INDEX `SeatingTable_sortOrder_idx` ON `SeatingTable` (`sortOrder`);