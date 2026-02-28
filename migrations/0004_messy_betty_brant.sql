ALTER TABLE `Event` ADD `rsvpRequired` integer DEFAULT false NOT NULL;
UPDATE `Event` SET `rsvpRequired` = 1 WHERE `type` != 'main';
