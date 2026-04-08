PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Attendee` (
	`id` text PRIMARY KEY NOT NULL,
	`rsvpResponseId` text NOT NULL,
	`name` text NOT NULL,
	`mealOption` text,
	`dietaryRestrictions` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`rsvpResponseId`) REFERENCES `RsvpResponse`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Attendee`("id", "rsvpResponseId", "name", "mealOption", "dietaryRestrictions", "sortOrder", "createdAt") SELECT "id", "rsvpResponseId", "name", "mealOption", "dietaryRestrictions", "sortOrder", "createdAt" FROM `Attendee`;--> statement-breakpoint
DROP TABLE `Attendee`;--> statement-breakpoint
ALTER TABLE `__new_Attendee` RENAME TO `Attendee`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `Attendee_rsvpResponseId_idx` ON `Attendee` (`rsvpResponseId`);