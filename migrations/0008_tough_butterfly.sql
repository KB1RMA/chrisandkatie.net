ALTER TABLE `GuestPhoto` ADD `eventId` text REFERENCES Event(id);--> statement-breakpoint
CREATE INDEX `GuestPhoto_eventId_idx` ON `GuestPhoto` (`eventId`);