ALTER TABLE `maya_mood_logs` ADD `checkInId` int;--> statement-breakpoint
ALTER TABLE `maya_mood_logs` ADD `checkInId` int;--> statement-breakpoint
CREATE INDEX `maya_mood_session_created_idx` ON `maya_mood_logs` (`userId`,`checkInId`,`createdAt`);
