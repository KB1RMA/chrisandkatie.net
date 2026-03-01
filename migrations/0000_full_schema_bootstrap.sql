CREATE TABLE `Account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Account_provider_providerAccountId_key` ON `Account` (`provider`,`providerAccountId`);--> statement-breakpoint
CREATE TABLE `Guest` (
	`id` text PRIMARY KEY NOT NULL,
	`invitationId` text NOT NULL,
	`userId` text,
	`firstName` text NOT NULL,
	`lastName` text NOT NULL,
	`type` text DEFAULT 'adult' NOT NULL,
	`attending` integer,
	`mealChoice` text,
	`dietaryRestrictions` text,
	`notes` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`invitationId`) REFERENCES `Invitation`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Guest_userId_unique` ON `Guest` (`userId`);--> statement-breakpoint
CREATE INDEX `Guest_firstName_lastName_idx` ON `Guest` (`firstName`,`lastName`);--> statement-breakpoint
CREATE UNIQUE INDEX `Guest_userId_key` ON `Guest` (`userId`);--> statement-breakpoint
CREATE INDEX `Guest_invitationId_idx` ON `Guest` (`invitationId`);--> statement-breakpoint
CREATE TABLE `Invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`relationshipToCouple` text,
	`totalInvited` integer DEFAULT 1 NOT NULL,
	`address` text,
	`addressLine2` text,
	`city` text,
	`state` text,
	`zipCode` text,
	`country` text,
	`mailingAddress` text,
	`visibleEvents` text DEFAULT '[0,1,2,3]' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Session_sessionToken_key` ON `Session` (`sessionToken`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` integer,
	`image` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_key` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `VerificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_token_key` ON `VerificationToken` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_identifier_token_key` ON `VerificationToken` (`identifier`,`token`);
