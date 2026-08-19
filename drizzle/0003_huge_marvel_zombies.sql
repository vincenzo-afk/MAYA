CREATE TABLE `maya_daily_checkins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`checkInDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maya_daily_checkins_id` PRIMARY KEY(`id`),
	CONSTRAINT `maya_daily_checkins_user_date_unique` UNIQUE(`userId`,`checkInDate`)
);
--> statement-breakpoint
CREATE INDEX `maya_daily_checkins_user_created_idx` ON `maya_daily_checkins` (`userId`,`createdAt`);