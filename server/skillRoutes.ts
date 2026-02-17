import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as skillMgr from "./skillManager";
import { selectModel, callOpenRouterWithFallback, LLM_MODELS } from "./llmRouter";

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
});
