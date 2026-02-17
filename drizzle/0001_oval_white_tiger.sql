CREATE TABLE `affiliate_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` varchar(100) NOT NULL,
	`productName` varchar(500),
	`productUrl` text,
	`affiliateUrl` text NOT NULL,
	`shortCode` varchar(50),
	`clicks` int DEFAULT 0,
	`conversions` int DEFAULT 0,
	`revenue` float DEFAULT 0,
	`lastClickAt` timestamp,
	`lastConversionAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_links_shortCode_unique` UNIQUE(`shortCode`)
);
--> statement-breakpoint
CREATE TABLE `cs_api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appName` varchar(255) NOT NULL,
	`apiKey` varchar(64) NOT NULL,
	`widgetConfig` json,
	`enabled` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cs_api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `cs_api_keys_appName_unique` UNIQUE(`appName`),
	CONSTRAINT `cs_api_keys_apiKey_unique` UNIQUE(`apiKey`)
);
--> statement-breakpoint
CREATE TABLE `error_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`errorType` varchar(255),
	`errorMessage` text,
	`stackTrace` text,
	`diagnosis` text,
	`fixAttempted` text,
	`fixSuccessful` boolean,
	`retryCount` int DEFAULT 0,
	`escalated` boolean DEFAULT false,
	`escalationReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `error_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `failure_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patternHash` varchar(64) NOT NULL,
	`errorType` varchar(255),
	`errorSignature` text,
	`occurrenceCount` int DEFAULT 1,
	`lastOccurrence` timestamp NOT NULL DEFAULT (now()),
	`successfulFix` text,
	`preventionStrategy` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `failure_patterns_id` PRIMARY KEY(`id`),
	CONSTRAINT `failure_patterns_patternHash_unique` UNIQUE(`patternHash`)
);
--> statement-breakpoint
CREATE TABLE `github_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repoId` int NOT NULL,
	`findingType` enum('invention','blue-ocean','code-quality','dependency','security','commit','pr','cleanup') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`title` varchar(500) NOT NULL,
	`description` text,
	`recommendation` text,
	`resolved` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `github_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `github_repos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`repoName` varchar(255) NOT NULL,
	`owner` varchar(255) NOT NULL,
	`lastCheckedAt` timestamp,
	`lastCommitSha` varchar(64),
	`issuesCount` int DEFAULT 0,
	`prsCount` int DEFAULT 0,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `github_repos_id` PRIMARY KEY(`id`),
	CONSTRAINT `github_repos_repoName_unique` UNIQUE(`repoName`)
);
--> statement-breakpoint
CREATE TABLE `innovations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`innovationId` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`category` enum('efficiency','revenue','blue-ocean','automation','ip-patent','cost-optimization','business-model') NOT NULL,
	`trigger` varchar(255),
	`impactScore` int NOT NULL,
	`effortScore` int NOT NULL,
	`noveltyScore` int NOT NULL,
	`priorityScore` float NOT NULL,
	`status` enum('proposed','in-progress','implemented','rejected') NOT NULL DEFAULT 'proposed',
	`outcome` text,
	`contextData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `innovations_id` PRIMARY KEY(`id`),
	CONSTRAINT `innovations_innovationId_unique` UNIQUE(`innovationId`)
);
--> statement-breakpoint
CREATE TABLE `monitored_servers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serverName` varchar(255) NOT NULL,
	`ipAddress` varchar(50) NOT NULL,
	`appName` varchar(255),
	`healthCheckUrl` text,
	`status` enum('healthy','degraded','down','unknown') NOT NULL DEFAULT 'unknown',
	`lastCheckAt` timestamp,
	`lastDowntime` timestamp,
	`uptimePercentage` float DEFAULT 100,
	`autoRestartEnabled` boolean DEFAULT true,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitored_servers_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitored_servers_ipAddress_unique` UNIQUE(`ipAddress`)
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appName` varchar(255) NOT NULL,
	`stripeEventId` varchar(255) NOT NULL,
	`eventType` varchar(255) NOT NULL,
	`customerId` varchar(255),
	`paymentIntentId` varchar(255),
	`amount` int,
	`currency` varchar(10),
	`status` enum('succeeded','failed','requires-action','processing') NOT NULL,
	`failureReason` text,
	`retryAttempt` int DEFAULT 0,
	`fraudScore` float,
	`fraudFlags` json,
	`blocked` boolean DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_events_stripeEventId_unique` UNIQUE(`stripeEventId`)
);
--> statement-breakpoint
CREATE TABLE `refund_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int,
	`appName` varchar(255) NOT NULL,
	`customerId` varchar(255),
	`paymentIntentId` varchar(255),
	`amount` int,
	`reason` text,
	`status` enum('pending','approved','rejected','processed') NOT NULL DEFAULT 'pending',
	`processedAt` timestamp,
	`refundId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refund_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `return_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int,
	`appName` varchar(255) NOT NULL,
	`customerId` varchar(255),
	`orderId` varchar(255),
	`items` json,
	`status` enum('pending','approved','label-sent','in-transit','received','completed','rejected') NOT NULL DEFAULT 'pending',
	`shippingLabelUrl` text,
	`trackingNumber` varchar(255),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `return_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `server_health_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serverId` int NOT NULL,
	`status` enum('healthy','degraded','down') NOT NULL,
	`responseTime` int,
	`errorMessage` text,
	`actionTaken` text,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `server_health_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skill_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`skillId` int NOT NULL,
	`status` enum('running','success','failed','retrying') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`duration` int,
	`output` text,
	`errorLog` text,
	`metadata` json,
	CONSTRAINT `skill_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skill_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skillId` int NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`executionMode` enum('continuous','interval','one-time','cron') NOT NULL,
	`intervalHours` int,
	`cronExpression` varchar(255),
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`status` enum('idle','running','scheduled','error','completed') NOT NULL DEFAULT 'idle',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skill_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`version` varchar(50) NOT NULL,
	`description` text,
	`category` varchar(100),
	`author` varchar(255),
	`tags` json,
	`source` varchar(100),
	`dependencies` json,
	`implementation` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `skills_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliateLinkId` int,
	`platform` enum('tiktok','instagram','facebook','twitter','linkedin') NOT NULL,
	`content` text,
	`mediaUrls` json,
	`scheduledFor` timestamp,
	`postedAt` timestamp,
	`status` enum('draft','scheduled','posted','failed') NOT NULL DEFAULT 'draft',
	`engagement` json,
	`abTestVariant` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int,
	`appName` varchar(255) NOT NULL,
	`customerId` varchar(255),
	`subscriptionId` varchar(255),
	`actionType` enum('cancel','pause','resume','upgrade','downgrade') NOT NULL,
	`retentionOfferShown` boolean DEFAULT false,
	`retentionOfferAccepted` boolean,
	`offerDetails` text,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketNumber` varchar(50) NOT NULL,
	`appName` varchar(255) NOT NULL,
	`customerId` varchar(255),
	`customerEmail` varchar(320),
	`customerName` varchar(255),
	`subject` varchar(500),
	`description` text,
	`category` enum('general','refund','return','subscription','technical','billing') NOT NULL DEFAULT 'general',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('open','in-progress','waiting-customer','resolved','closed') NOT NULL DEFAULT 'open',
	`assignedTo` int,
	`resolvedAt` timestamp,
	`resolutionTime` int,
	`satisfactionScore` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `support_tickets_ticketNumber_unique` UNIQUE(`ticketNumber`)
);
--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`senderId` int,
	`senderType` enum('customer','staff','ai') NOT NULL,
	`message` text NOT NULL,
	`aiGenerated` boolean DEFAULT false,
	`attachments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `platform_idx` ON `affiliate_links` (`platform`);--> statement-breakpoint
CREATE INDEX `run_id_idx` ON `error_logs` (`runId`);--> statement-breakpoint
CREATE INDEX `escalated_idx` ON `error_logs` (`escalated`);--> statement-breakpoint
CREATE INDEX `repo_id_idx` ON `github_findings` (`repoId`);--> statement-breakpoint
CREATE INDEX `finding_type_idx` ON `github_findings` (`findingType`);--> statement-breakpoint
CREATE INDEX `resolved_idx` ON `github_findings` (`resolved`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `innovations` (`category`);--> statement-breakpoint
CREATE INDEX `priority_score_idx` ON `innovations` (`priorityScore`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `innovations` (`status`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `monitored_servers` (`status`);--> statement-breakpoint
CREATE INDEX `app_name_idx` ON `payment_events` (`appName`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `payment_events` (`status`);--> statement-breakpoint
CREATE INDEX `customer_id_idx` ON `payment_events` (`customerId`);--> statement-breakpoint
CREATE INDEX `ticket_id_idx` ON `refund_requests` (`ticketId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `refund_requests` (`status`);--> statement-breakpoint
CREATE INDEX `ticket_id_idx` ON `return_requests` (`ticketId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `return_requests` (`status`);--> statement-breakpoint
CREATE INDEX `server_id_idx` ON `server_health_checks` (`serverId`);--> statement-breakpoint
CREATE INDEX `checked_at_idx` ON `server_health_checks` (`checkedAt`);--> statement-breakpoint
CREATE INDEX `schedule_id_idx` ON `skill_runs` (`scheduleId`);--> statement-breakpoint
CREATE INDEX `skill_id_idx` ON `skill_runs` (`skillId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `skill_runs` (`status`);--> statement-breakpoint
CREATE INDEX `started_at_idx` ON `skill_runs` (`startedAt`);--> statement-breakpoint
CREATE INDEX `skill_id_idx` ON `skill_schedules` (`skillId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `skill_schedules` (`userId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `skill_schedules` (`status`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `skills` (`category`);--> statement-breakpoint
CREATE INDEX `source_idx` ON `skills` (`source`);--> statement-breakpoint
CREATE INDEX `affiliate_link_id_idx` ON `social_posts` (`affiliateLinkId`);--> statement-breakpoint
CREATE INDEX `platform_idx` ON `social_posts` (`platform`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `social_posts` (`status`);--> statement-breakpoint
CREATE INDEX `ticket_id_idx` ON `subscription_actions` (`ticketId`);--> statement-breakpoint
CREATE INDEX `subscription_id_idx` ON `subscription_actions` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `app_name_idx` ON `support_tickets` (`appName`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `support_tickets` (`status`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `support_tickets` (`category`);--> statement-breakpoint
CREATE INDEX `customer_id_idx` ON `support_tickets` (`customerId`);--> statement-breakpoint
CREATE INDEX `ticket_id_idx` ON `ticket_messages` (`ticketId`);