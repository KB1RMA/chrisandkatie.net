ALTER TABLE `Invitation` ADD `invitationCode` text;--> statement-breakpoint
ALTER TABLE `Invitation` ADD `contactEmail` text;--> statement-breakpoint
ALTER TABLE `Invitation` ADD `userId` text REFERENCES User(id);--> statement-breakpoint
CREATE UNIQUE INDEX `Invitation_invitationCode_unique` ON `Invitation` (`invitationCode`);