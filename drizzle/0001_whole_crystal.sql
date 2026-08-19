CREATE TABLE `maya_game_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gameType` enum('chess','sudoku','ticTacToe','brainteaser','math','calendar','voice') NOT NULL,
	`state` json NOT NULL,
	`result` varchar(32),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maya_game_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maya_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topic` varchar(160) NOT NULL,
	`detail` text NOT NULL,
	`category` varchar(48) NOT NULL DEFAULT 'preference',
	`relevance` int NOT NULL DEFAULT 3,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maya_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maya_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','maya') NOT NULL,
	`kind` enum('text','voice','photo','activity') NOT NULL DEFAULT 'text',
	`content` text NOT NULL,
	`mediaUrl` text,
	`emotion` varchar(32),
	`emotionIntensity` int,
	`reactions` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maya_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maya_mood_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userMood` varchar(96) NOT NULL,
	`mayaEmotion` varchar(32) NOT NULL,
	`intensity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maya_mood_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maya_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theme` enum('violet','rose','ocean','sunset') NOT NULL DEFAULT 'violet',
	`voiceStyle` int NOT NULL DEFAULT 0,
	`displayPhoto` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maya_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `maya_preferences_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `maya_youtube_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`videoUrl` text NOT NULL,
	`title` varchar(320),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maya_youtube_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `maya_games_user_updated_idx` ON `maya_game_sessions` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `maya_memories_user_updated_idx` ON `maya_memories` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `maya_messages_user_created_idx` ON `maya_messages` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `maya_mood_user_created_idx` ON `maya_mood_logs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `maya_youtube_user_created_idx` ON `maya_youtube_sessions` (`userId`,`createdAt`);