CREATE TABLE `maya_relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rapportScore` int NOT NULL DEFAULT 1,
	`preferredTone` varchar(64) NOT NULL DEFAULT 'warm and curious',
	`recurringMood` varchar(96),
	`lastMeaningfulTopic` varchar(160),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maya_relationships_id` PRIMARY KEY(`id`),
	CONSTRAINT `maya_relationships_user_unique` UNIQUE(`userId`)
);
