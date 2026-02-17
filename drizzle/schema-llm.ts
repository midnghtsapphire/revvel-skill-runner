import { int, mysqlEnum, mysqlTable, text, varchar, boolean, float, json, index, unique, timestamp } from "drizzle-orm/mysql-core";

/**
 * LLM Models catalog from OpenRouter
 */
export const llmModels = mysqlTable("llm_models", {
  id: int("id").autoincrement().primaryKey(),
  modelId: varchar("modelId", { length: 255 }).notNull().unique(), // e.g., "venice/uncensored:free"
  modelName: varchar("modelName", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(), // venice, cognitivecomputations, nous, etc
  tier: mysqlEnum("tier", ["free-uncensored", "paid-uncensored", "free-censored", "paid-censored"]).notNull(),
  censored: boolean("censored").notNull(),
  costPerMTok: float("costPerMTok").default(0), // cost per million tokens
  costPerCTok: float("costPerCTok").default(0), // cost per completion tokens
  contextWindow: int("contextWindow"), // max tokens
  description: text("description"),
  metadata: json("metadata").$type<Record<string, any>>(),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tierIdx: index("tier_idx").on(table.tier),
  providerIdx: index("provider_idx").on(table.provider),
  censoredIdx: index("censored_idx").on(table.censored),
}));

export type LlmModel = typeof llmModels.$inferSelect;
export type InsertLlmModel = typeof llmModels.$inferInsert;

/**
 * Skill LLM preferences
 */
export const skillLlmPreferences = mysqlTable("skill_llm_preferences", {
  id: int("id").autoincrement().primaryKey(),
  skillId: int("skillId").notNull(),
  preferredModelId: int("preferredModelId"),
  preferredTier: mysqlEnum("preferredTier", ["free-first", "paid-first", "uncensored-only", "censored-only"]).default("free-first").notNull(),
  allowUncensored: boolean("allowUncensored").default(true),
  allowCensored: boolean("allowCensored").default(true),
  fallbackChain: json("fallbackChain").$type<number[]>(), // ordered list of model IDs to try
  maxCostPerCall: float("maxCostPerCall"), // max cost threshold before escalation
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  skillIdIdx: index("skill_id_idx").on(table.skillId),
}));

export type SkillLlmPreference = typeof skillLlmPreferences.$inferSelect;
export type InsertSkillLlmPreference = typeof skillLlmPreferences.$inferInsert;

/**
 * Global LLM preferences
 */
export const globalLlmSettings = mysqlTable("global_llm_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  defaultTier: mysqlEnum("defaultTier", ["free-first", "paid-first", "uncensored-only", "censored-only"]).default("free-first").notNull(),
  allowUncensored: boolean("allowUncensored").default(true),
  allowCensored: boolean("allowCensored").default(true),
  maxMonthlySpend: float("maxMonthlySpend"), // monthly budget cap
  autoFallback: boolean("autoFallback").default(true), // auto-handoff on rate limit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  unique("user_id_unique").on(table.userId),
}));

export type GlobalLlmSetting = typeof globalLlmSettings.$inferSelect;
export type InsertGlobalLlmSetting = typeof globalLlmSettings.$inferInsert;

/**
 * LLM API call tracking
 */
export const llmApiCalls = mysqlTable("llm_api_calls", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId"), // skill run ID
  modelId: int("modelId").notNull(),
  prompt: text("prompt"),
  response: text("response"),
  inputTokens: int("inputTokens"),
  outputTokens: int("outputTokens"),
  cost: float("cost"),
  latency: int("latency"), // in ms
  status: mysqlEnum("status", ["success", "rate-limited", "failed", "fallback"]).notNull(),
  errorMessage: text("errorMessage"),
  fallbackTo: int("fallbackTo"), // model ID if fell back
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  runIdIdx: index("run_id_idx").on(table.runId),
  modelIdIdx: index("model_id_idx").on(table.modelId),
  statusIdx: index("status_idx").on(table.status),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export type LlmApiCall = typeof llmApiCalls.$inferSelect;
export type InsertLlmApiCall = typeof llmApiCalls.$inferInsert;

/**
 * Rate limit tracking per model
 */
export const llmRateLimits = mysqlTable("llm_rate_limits", {
  id: int("id").autoincrement().primaryKey(),
  modelId: int("modelId").notNull(),
  requestsPerMinute: int("requestsPerMinute"),
  tokensPerMinute: int("tokensPerMinute"),
  currentRequestCount: int("currentRequestCount").default(0),
  currentTokenCount: int("currentTokenCount").default(0),
  resetAt: timestamp("resetAt"),
  lastLimitHit: timestamp("lastLimitHit"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  modelIdIdx: index("model_id_idx").on(table.modelId),
  unique("model_id_unique").on(table.modelId),
}));

export type LlmRateLimit = typeof llmRateLimits.$inferSelect;
export type InsertLlmRateLimit = typeof llmRateLimits.$inferInsert;

/**
 * Monthly LLM usage and cost tracking
 */
export const llmUsageStats = mysqlTable("llm_usage_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  modelId: int("modelId").notNull(),
  month: varchar("month", { length: 7 }), // YYYY-MM format
  callCount: int("callCount").default(0),
  totalInputTokens: int("totalInputTokens").default(0),
  totalOutputTokens: int("totalOutputTokens").default(0),
  totalCost: float("totalCost").default(0),
  successRate: float("successRate").default(100), // percentage
  avgLatency: float("avgLatency"), // in ms
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  modelIdIdx: index("model_id_idx").on(table.modelId),
  monthIdx: index("month_idx").on(table.month),
  unique("user_model_month_unique").on(table.userId, table.modelId, table.month),
}));

export type LlmUsageStat = typeof llmUsageStats.$inferSelect;
export type InsertLlmUsageStat = typeof llmUsageStats.$inferInsert;


