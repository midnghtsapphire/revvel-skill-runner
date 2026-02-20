import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as skillMgr from "./skillManager";
import { selectModel, callOpenRouterWithFallback, LLM_MODELS } from "./llmRouter";
import { healFailedSkill, getHealingStats, getRecentErrors } from "./selfHealing";
import { scanAllRepos, getRecentFindings, getFindingsByType, getMonitoredRepos, resolveFinding } from "./githubWatcher";
import { runInnovationEngine, getRecentInnovations, getTopInnovations, readInnovationsFile } from "./innovationEngine";
import * as affiliate from "./affiliateMarketing";
import * as infra from "./infrastructureMonitoring";

export const skillsRouter = router({
  /**
   * Skill Browser
   */
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      return skillMgr.listSkills(input.category, input.limit, input.offset);
    }),

  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      return skillMgr.searchSkills(input.query);
    }),

  categories: publicProcedure
    .query(async () => {
      return skillMgr.getSkillCategories();
    }),

  /**
   * Skill Scheduling
   */
  createSchedule: protectedProcedure
    .input(z.object({
      skillId: z.number(),
      executionMode: z.enum(["continuous", "interval", "one-time", "cron"]),
      intervalHours: z.number().optional(),
      cronExpression: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await skillMgr.createSkillSchedule(
        input.skillId,
        ctx.user.id,
        input.executionMode,
        {
          intervalHours: input.intervalHours,
          cronExpression: input.cronExpression,
        }
      );
      return result;
    }),

  listSchedules: protectedProcedure
    .query(async ({ ctx }) => {
      return skillMgr.listSchedulesForUser(ctx.user.id);
    }),

  toggleSchedule: protectedProcedure
    .input(z.object({
      scheduleId: z.number(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await skillMgr.toggleSchedule(input.scheduleId, input.enabled);
      return { success: true };
    }),

  /**
   * Skill Execution History
   */
  runs: protectedProcedure
    .input(z.object({
      scheduleId: z.number(),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return skillMgr.listRunsForSchedule(input.scheduleId, input.limit);
    }),

  /**
   * LLM Models
   */
  llmModels: publicProcedure
    .input(z.object({
      tier: z.enum(["free-uncensored", "paid-uncensored", "free-censored", "paid-censored"]).optional(),
    }))
    .query(async ({ input }) => {
      const models = Object.values(LLM_MODELS);
      if (input.tier) {
        return models.filter(m => m.tier === input.tier);
      }
      return models;
    }),

  /**
   * LLM Routing
   */
  selectModel: publicProcedure
    .input(z.object({
      tier: z.enum(["free-first", "paid-first", "uncensored-only", "censored-only"]).default("free-first"),
      allowUncensored: z.boolean().default(true),
      allowCensored: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      return selectModel(input.tier, input.allowUncensored, input.allowCensored);
    }),

  /**
   * Test LLM Call
   */
  testLlm: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      tier: z.enum(["free-first", "paid-first", "uncensored-only", "censored-only"]).default("free-first"),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await callOpenRouterWithFallback(
          [{ role: "user", content: input.prompt }],
          input.tier
        );
        return {
          success: true,
          response: result.content,
          model: result.model,
          cost: result.cost,
          tokens: {
            input: result.inputTokens,
            output: result.outputTokens,
          },
          fallbackUsed: result.fallbackUsed,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }),

  /**
   * Dashboard Stats
   */
  dashboardStats: protectedProcedure
    .query(async ({ ctx }) => {
      const schedules = await skillMgr.listSchedulesForUser(ctx.user.id);
      
      const stats = {
        totalSchedules: schedules.length,
        activeSchedules: schedules.filter(s => s.enabled).length,
        continuousSkills: schedules.filter(s => s.executionMode === "continuous").length,
        scheduledSkills: schedules.filter(s => s.status === "scheduled").length,
        errorSkills: schedules.filter(s => s.status === "error").length,
        schedules,
      };

      return stats;
    }),

  // Self-Healing Engine
  healingStats: publicProcedure.query(async () => {
    return await getHealingStats();
  }),

  recentErrors: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await getRecentErrors(input.limit);
    }),

  healError: protectedProcedure
    .input(
      z.object({
        scheduleId: z.number(),
        skillId: z.number(),
        errorMessage: z.string(),
        errorStack: z.string().optional(),
        attemptNumber: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      return await healFailedSkill({
        ...input,
        timestamp: new Date(),
      });
    }),

  // GitHub Watcher
  scanRepos: protectedProcedure.mutation(async () => {
    return await scanAllRepos();
  }),

  githubFindings: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await getRecentFindings(input.limit);
    }),

  githubFindingsByType: publicProcedure
    .input(z.object({ type: z.string() }))
    .query(async ({ input }) => {
      return await getFindingsByType(input.type);
    }),

  monitoredRepos: publicProcedure.query(async () => {
    return await getMonitoredRepos();
  }),

  resolveFinding: protectedProcedure
    .input(z.object({ findingId: z.number() }))
    .mutation(async ({ input }) => {
      await resolveFinding(input.findingId);
      return { success: true };
    }),

  // Innovation Engine
  generateInnovation: protectedProcedure.mutation(async () => {
    return await runInnovationEngine();
  }),

  recentInnovations: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await getRecentInnovations(input.limit);
    }),

  topInnovations: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await getTopInnovations(input.limit);
    }),

  innovationsFile: publicProcedure.query(async () => {
    return await readInnovationsFile();
  }),

  // Affiliate Marketing
  createAffiliateLink: protectedProcedure
    .input(
      z.object({
        platform: z.string(),
        productName: z.string(),
        productUrl: z.string(),
        affiliateUrl: z.string(),
        shortCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await affiliate.createAffiliateLink(input);
    }),

  generateMarketingContent: protectedProcedure
    .input(
      z.object({
        productName: z.string(),
        productDescription: z.string(),
        platform: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return await affiliate.generateMarketingContent(
        input.productName,
        input.productDescription,
        input.platform
      );
    }),

  affiliateLinks: publicProcedure.query(async () => {
    return await affiliate.getAllAffiliateLinks();
  }),

  affiliateAnalytics: publicProcedure.query(async () => {
    return await affiliate.getAffiliateAnalytics();
  }),

  topPerformers: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await affiliate.getTopPerformers(input.limit);
    }),

  // Infrastructure Monitoring
  registerServer: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        url: z.string(),
        type: z.enum(["web", "api", "database", "other"]),
        expectedStatus: z.number(),
        checkInterval: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      return await infra.registerServer(input);
    }),

  allServers: publicProcedure.query(async () => {
    return await infra.getAllServers();
  }),

  performHealthCheck: protectedProcedure
    .input(z.object({ serverId: z.number() }))
    .mutation(async ({ input }) => {
      return await infra.performHealthCheck(input.serverId);
    }),

  serverHealthHistory: publicProcedure
    .input(z.object({ serverId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await infra.getServerHealthHistory(input.serverId, input.limit);
    }),

  infrastructureOverview: publicProcedure.query(async () => {
    return await infra.getInfrastructureOverview();
  }),
});
