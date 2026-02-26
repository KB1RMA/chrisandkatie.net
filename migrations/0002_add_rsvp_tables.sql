CREATE TABLE `Attendee` (
	`id` text PRIMARY KEY NOT NULL,
	`rsvpResponseId` text NOT NULL,
	`name` text NOT NULL,
	`mealOption` text NOT NULL,
	`dietaryRestrictions` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`rsvpResponseId`) REFERENCES `RsvpResponse`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Attendee_rsvpResponseId_idx` ON `Attendee` (`rsvpResponseId`);--> statement-breakpoint
CREATE TABLE `Event` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`location` text,
	`eventDate` text NOT NULL,
	`eventTime` text NOT NULL,
	`duration` integer,
	`type` text DEFAULT 'main' NOT NULL,
	`dressCode` text,
	`parkingInfo` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Event_eventDate_idx` ON `Event` (`eventDate`);--> statement-breakpoint
CREATE INDEX `Event_type_idx` ON `Event` (`type`);--> statement-breakpoint
CREATE TABLE `GuestEvent` (
	`id` text PRIMARY KEY NOT NULL,
	`guestId` text NOT NULL,
	`eventId` text NOT NULL,
	FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `GuestEvent_guestId_eventId_key` ON `GuestEvent` (`guestId`,`eventId`);--> statement-breakpoint
CREATE INDEX `GuestEvent_guestId_idx` ON `GuestEvent` (`guestId`);--> statement-breakpoint
CREATE INDEX `GuestEvent_eventId_idx` ON `GuestEvent` (`eventId`);--> statement-breakpoint
CREATE TABLE `Photo` (
	`id` text PRIMARY KEY NOT NULL,
	`imageUrl` text NOT NULL,
	`caption` text,
	`description` text,
	`dateTaken` text,
	`milestone` text,
	`album` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Photo_album_idx` ON `Photo` (`album`);--> statement-breakpoint
CREATE INDEX `Photo_dateTaken_idx` ON `Photo` (`dateTaken`);--> statement-breakpoint
CREATE TABLE `RsvpResponse` (
	`id` text PRIMARY KEY NOT NULL,
	`guestId` text NOT NULL,
	`eventId` text NOT NULL,
	`attendanceStatus` text NOT NULL,
	`numberOfAttending` integer DEFAULT 0 NOT NULL,
	`specialRequests` text,
	`submittedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RsvpResponse_guestId_eventId_key` ON `RsvpResponse` (`guestId`,`eventId`);--> statement-breakpoint
CREATE INDEX `RsvpResponse_guestId_idx` ON `RsvpResponse` (`guestId`);--> statement-breakpoint
CREATE INDEX `RsvpResponse_eventId_idx` ON `RsvpResponse` (`eventId`);