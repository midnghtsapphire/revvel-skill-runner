import { int, mysqlEnum, mysqlTable, text, varchar, boolean, float, json, index, unique, timestamp } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Skills from revvel-skills-vault
 */
export const skills = mysqlTable("skills", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  author: varchar("author", { length: 255 }),
  tags: json("tags").$type<string[]>(),
  source: varchar("source", { length: 100 }),
  dependencies: json("dependencies").$type<Record<string, any>>(),
  implementation: json("implementation").$type<Record<string, any>>(),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("category_idx").on(table.category),
  sourceIdx: index("source_idx").on(table.source),
}));

export type Skill = typeof skills.$inferSelect;
export type InsertSkill = typeof skills.$inferInsert;

/**
 * Scheduled skill executions
 */
export const skillSchedules = mysqlTable("skill_schedules", {
  id: int("id").autoincrement().primaryKey(),
  skillId: int("skillId").notNull(),
  userId: int("userId").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  executionMode: mysqlEnum("executionMode", ["continuous", "interval", "one-time", "cron"]).notNull(),
  intervalHours: int("intervalHours"),
  cronExpression: varchar("cronExpression", { length: 255 }),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  status: mysqlEnum("status", ["idle", "running", "scheduled", "error", "completed"]).default("idle").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  skillIdIdx: index("skill_id_idx").on(table.skillId),
  userIdIdx: index("user_id_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
}));

export type SkillSchedule = typeof skillSchedules.$inferSelect;
export type InsertSkillSchedule = typeof skillSchedules.$inferInsert;

/**
 * Skill execution history
 */
export const skillRuns = mysqlTable("skill_runs", {
  id: int("id").autoincrement().primaryKey(),
  scheduleId: int("scheduleId").notNull(),
  skillId: int("skillId").notNull(),
  status: mysqlEnum("status", ["running", "success", "failed", "retrying"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
  output: text("output"),
  errorLog: text("errorLog"),
  metadata: json("metadata").$type<Record<string, any>>(),
}, (table) => ({
  scheduleIdIdx: index("schedule_id_idx").on(table.scheduleId),
  skillIdIdx: index("skill_id_idx").on(table.skillId),
  statusIdx: index("status_idx").on(table.status),
  startedAtIdx: index("started_at_idx").on(table.startedAt),
}));

export type SkillRun = typeof skillRuns.$inferSelect;
export type InsertSkillRun = typeof skillRuns.$inferInsert;

/**
 * Self-healing engine error tracking
 */
export const errorLogs = mysqlTable("error_logs", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  errorType: varchar("errorType", { length: 255 }),
  errorMessage: text("errorMessage"),
  stackTrace: text("stackTrace"),
  diagnosis: text("diagnosis"),
  fixAttempted: text("fixAttempted"),
  fixSuccessful: boolean("fixSuccessful"),
  retryCount: int("retryCount").default(0),
  escalated: boolean("escalated").default(false),
  escalationReason: text("escalationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runIdIdx: index("run_id_idx").on(table.runId),
  escalatedIdx: index("escalated_idx").on(table.escalated),
}));

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;

/**
 * Failure patterns for self-healing
 */
export const failurePatterns = mysqlTable("failure_patterns", {
  id: int("id").autoincrement().primaryKey(),
  patternHash: varchar("patternHash", { length: 64 }).notNull().unique(),
  errorType: varchar("errorType", { length: 255 }),
  errorSignature: text("errorSignature"),
  occurrenceCount: int("occurrenceCount").default(1),
  lastOccurrence: timestamp("lastOccurrence").defaultNow().notNull(),
  successfulFix: text("successfulFix"),
  preventionStrategy: text("preventionStrategy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FailurePattern = typeof failurePatterns.$inferSelect;
export type InsertFailurePattern = typeof failurePatterns.$inferInsert;

/**
 * Innovation engine ideas
 */
export const innovations = mysqlTable("innovations", {
  id: int("id").autoincrement().primaryKey(),
  innovationId: varchar("innovationId", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["efficiency", "revenue", "blue-ocean", "automation", "ip-patent", "cost-optimization", "business-model"]).notNull(),
  trigger: varchar("trigger", { length: 255 }),
  impactScore: int("impactScore").notNull(),
  effortScore: int("effortScore").notNull(),
  noveltyScore: int("noveltyScore").notNull(),
  priorityScore: float("priorityScore").notNull(),
  status: mysqlEnum("status", ["proposed", "in-progress", "implemented", "rejected"]).default("proposed").notNull(),
  outcome: text("outcome"),
  contextData: json("contextData").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("category_idx").on(table.category),
  priorityScoreIdx: index("priority_score_idx").on(table.priorityScore),
  statusIdx: index("status_idx").on(table.status),
}));

export type Innovation = typeof innovations.$inferSelect;
export type InsertInnovation = typeof innovations.$inferInsert;

/**
 * GitHub repository monitoring
 */
export const githubRepos = mysqlTable("github_repos", {
  id: int("id").autoincrement().primaryKey(),
  repoName: varchar("repoName", { length: 255 }).notNull().unique(),
  owner: varchar("owner", { length: 255 }).notNull(),
  lastCheckedAt: timestamp("lastCheckedAt"),
  lastCommitSha: varchar("lastCommitSha", { length: 64 }),
  issuesCount: int("issuesCount").default(0),
  prsCount: int("prsCount").default(0),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GithubRepo = typeof githubRepos.$inferSelect;
export type InsertGithubRepo = typeof githubRepos.$inferInsert;

/**
 * GitHub review findings
 */
export const githubFindings = mysqlTable("github_findings", {
  id: int("id").autoincrement().primaryKey(),
  repoId: int("repoId").notNull(),
  findingType: mysqlEnum("findingType", ["invention", "blue-ocean", "code-quality", "dependency", "security", "commit", "pr", "cleanup"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  recommendation: text("recommendation"),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  repoIdIdx: index("repo_id_idx").on(table.repoId),
  findingTypeIdx: index("finding_type_idx").on(table.findingType),
  resolvedIdx: index("resolved_idx").on(table.resolved),
}));

export type GithubFinding = typeof githubFindings.$inferSelect;
export type InsertGithubFinding = typeof githubFindings.$inferInsert;

/**
 * Affiliate marketing links
 */
export const affiliateLinks = mysqlTable("affiliate_links", {
  id: int("id").autoincrement().primaryKey(),
  platform: varchar("platform", { length: 100 }).notNull(),
  productName: varchar("productName", { length: 500 }),
  productUrl: text("productUrl"),
  affiliateUrl: text("affiliateUrl").notNull(),
  shortCode: varchar("shortCode", { length: 50 }).unique(),
  clicks: int("clicks").default(0),
  conversions: int("conversions").default(0),
  revenue: float("revenue").default(0),
  lastClickAt: timestamp("lastClickAt"),
  lastConversionAt: timestamp("lastConversionAt"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  platformIdx: index("platform_idx").on(table.platform),
}));

export type AffiliateLink = typeof affiliateLinks.$inferSelect;
export type InsertAffiliateLink = typeof affiliateLinks.$inferInsert;

/**
 * Social media posts for affiliate marketing
 */
export const socialPosts = mysqlTable("social_posts", {
  id: int("id").autoincrement().primaryKey(),
  affiliateLinkId: int("affiliateLinkId"),
  platform: mysqlEnum("platform", ["tiktok", "instagram", "facebook", "twitter", "linkedin"]).notNull(),
  content: text("content"),
  mediaUrls: json("mediaUrls").$type<string[]>(),
  scheduledFor: timestamp("scheduledFor"),
  postedAt: timestamp("postedAt"),
  status: mysqlEnum("status", ["draft", "scheduled", "posted", "failed"]).default("draft").notNull(),
  engagement: json("engagement").$type<{ likes?: number; shares?: number; comments?: number; clicks?: number }>(),
  abTestVariant: varchar("abTestVariant", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  affiliateLinkIdIdx: index("affiliate_link_id_idx").on(table.affiliateLinkId),
  platformIdx: index("platform_idx").on(table.platform),
  statusIdx: index("status_idx").on(table.status),
}));

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

/**
 * Infrastructure monitoring - DigitalOcean droplets
 */
export const monitoredServers = mysqlTable("monitored_servers", {
  id: int("id").autoincrement().primaryKey(),
  serverName: varchar("serverName", { length: 255 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 50 }).notNull().unique(),
  appName: varchar("appName", { length: 255 }),
  healthCheckUrl: text("healthCheckUrl"),
  status: mysqlEnum("status", ["healthy", "degraded", "down", "unknown"]).default("unknown").notNull(),
  lastCheckAt: timestamp("lastCheckAt"),
  lastDowntime: timestamp("lastDowntime"),
  uptimePercentage: float("uptimePercentage").default(100),
  autoRestartEnabled: boolean("autoRestartEnabled").default(true),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("status_idx").on(table.status),
}));

export type MonitoredServer = typeof monitoredServers.$inferSelect;
export type InsertMonitoredServer = typeof monitoredServers.$inferInsert;

/**
 * Server health check history
 */
export const serverHealthChecks = mysqlTable("server_health_checks", {
  id: int("id").autoincrement().primaryKey(),
  serverId: int("serverId").notNull(),
  status: mysqlEnum("status", ["healthy", "degraded", "down"]).notNull(),
  responseTime: int("responseTime"),
  errorMessage: text("errorMessage"),
  actionTaken: text("actionTaken"),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
}, (table) => ({
  serverIdIdx: index("server_id_idx").on(table.serverId),
  checkedAtIdx: index("checked_at_idx").on(table.checkedAt),
}));

export type ServerHealthCheck = typeof serverHealthChecks.$inferSelect;
export type InsertServerHealthCheck = typeof serverHealthChecks.$inferInsert;

/**
 * Payment protection - Stripe webhooks
 */
export const paymentEvents = mysqlTable("payment_events", {
  id: int("id").autoincrement().primaryKey(),
  appName: varchar("appName", { length: 255 }).notNull(),
  stripeEventId: varchar("stripeEventId", { length: 255 }).notNull().unique(),
  eventType: varchar("eventType", { length: 255 }).notNull(),
  customerId: varchar("customerId", { length: 255 }),
  paymentIntentId: varchar("paymentIntentId", { length: 255 }),
  amount: int("amount"),
  currency: varchar("currency", { length: 10 }),
  status: mysqlEnum("status", ["succeeded", "failed", "requires-action", "processing"]).notNull(),
  failureReason: text("failureReason"),
  retryAttempt: int("retryAttempt").default(0),
  fraudScore: float("fraudScore"),
  fraudFlags: json("fraudFlags").$type<string[]>(),
  blocked: boolean("blocked").default(false),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  appNameIdx: index("app_name_idx").on(table.appName),
  statusIdx: index("status_idx").on(table.status),
  customerIdIdx: index("customer_id_idx").on(table.customerId),
}));

export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type InsertPaymentEvent = typeof paymentEvents.$inferInsert;

/**
 * Customer service tickets
 */
export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  ticketNumber: varchar("ticketNumber", { length: 50 }).notNull().unique(),
  appName: varchar("appName", { length: 255 }).notNull(),
  customerId: varchar("customerId", { length: 255 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerName: varchar("customerName", { length: 255 }),
  subject: varchar("subject", { length: 500 }),
  description: text("description"),
  category: mysqlEnum("category", ["general", "refund", "return", "subscription", "technical", "billing"]).default("general").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in-progress", "waiting-customer", "resolved", "closed"]).default("open").notNull(),
  assignedTo: int("assignedTo"),
  resolvedAt: timestamp("resolvedAt"),
  resolutionTime: int("resolutionTime"),
  satisfactionScore: int("satisfactionScore"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  appNameIdx: index("app_name_idx").on(table.appName),
  statusIdx: index("status_idx").on(table.status),
  categoryIdx: index("category_idx").on(table.category),
  customerIdIdx: index("customer_id_idx").on(table.customerId),
}));

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

/**
 * Support ticket messages
 */
export const ticketMessages = mysqlTable("ticket_messages", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  senderId: int("senderId"),
  senderType: mysqlEnum("senderType", ["customer", "staff", "ai"]).notNull(),
  message: text("message").notNull(),
  aiGenerated: boolean("aiGenerated").default(false),
  attachments: json("attachments").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ticketIdIdx: index("ticket_id_idx").on(table.ticketId),
}));

export type TicketMessage = typeof ticketMessages.$inferSelect;
export type InsertTicketMessage = typeof ticketMessages.$inferInsert;

/**
 * Refund requests
 */
export const refundRequests = mysqlTable("refund_requests", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId"),
  appName: varchar("appName", { length: 255 }).notNull(),
  customerId: varchar("customerId", { length: 255 }),
  paymentIntentId: varchar("paymentIntentId", { length: 255 }),
  amount: int("amount"),
  reason: text("reason"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "processed"]).default("pending").notNull(),
  processedAt: timestamp("processedAt"),
  refundId: varchar("refundId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ticketIdIdx: index("ticket_id_idx").on(table.ticketId),
  statusIdx: index("status_idx").on(table.status),
}));

export type RefundRequest = typeof refundRequests.$inferSelect;
export type InsertRefundRequest = typeof refundRequests.$inferInsert;

/**
 * Return requests (for physical products)
 */
export const returnRequests = mysqlTable("return_requests", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId"),
  appName: varchar("appName", { length: 255 }).notNull(),
  customerId: varchar("customerId", { length: 255 }),
  orderId: varchar("orderId", { length: 255 }),
  items: json("items").$type<Array<{ productId: string; quantity: number; reason: string }>>(),
  status: mysqlEnum("status", ["pending", "approved", "label-sent", "in-transit", "received", "completed", "rejected"]).default("pending").notNull(),
  shippingLabelUrl: text("shippingLabelUrl"),
  trackingNumber: varchar("trackingNumber", { length: 255 }),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ticketIdIdx: index("ticket_id_idx").on(table.ticketId),
  statusIdx: index("status_idx").on(table.status),
}));

export type ReturnRequest = typeof returnRequests.$inferSelect;
export type InsertReturnRequest = typeof returnRequests.$inferInsert;

/**
 * Subscription management
 */
export const subscriptionActions = mysqlTable("subscription_actions", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId"),
  appName: varchar("appName", { length: 255 }).notNull(),
  customerId: varchar("customerId", { length: 255 }),
  subscriptionId: varchar("subscriptionId", { length: 255 }),
  actionType: mysqlEnum("actionType", ["cancel", "pause", "resume", "upgrade", "downgrade"]).notNull(),
  retentionOfferShown: boolean("retentionOfferShown").default(false),
  retentionOfferAccepted: boolean("retentionOfferAccepted"),
  offerDetails: text("offerDetails"),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ticketIdIdx: index("ticket_id_idx").on(table.ticketId),
  subscriptionIdIdx: index("subscription_id_idx").on(table.subscriptionId),
}));

export type SubscriptionAction = typeof subscriptionActions.$inferSelect;
export type InsertSubscriptionAction = typeof subscriptionActions.$inferInsert;

/**
 * Customer service API keys for app integration
 */
export const csApiKeys = mysqlTable("cs_api_keys", {
  id: int("id").autoincrement().primaryKey(),
  appName: varchar("appName", { length: 255 }).notNull().unique(),
  apiKey: varchar("apiKey", { length: 64 }).notNull().unique(),
  widgetConfig: json("widgetConfig").$type<Record<string, any>>(),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CsApiKey = typeof csApiKeys.$inferSelect;
export type InsertCsApiKey = typeof csApiKeys.$inferInsert;
