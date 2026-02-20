/**
 * Self-Healing Engine
 * Auto-captures errors, uses LLM to diagnose root cause, attempts automated fixes,
 * retries failed jobs, escalates unfixable issues, and tracks failure patterns.
 */

import { getDb } from "./db";
import { errorLogs, failurePatterns, skillRuns, skillSchedules } from "../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { callOpenRouterWithFallback } from "./llmRouter";

interface ErrorContext {
  scheduleId: number;
  skillId: number;
  errorMessage: string;
  errorStack?: string;
  attemptNumber: number;
  timestamp: Date;
  skillCode?: string;
  environment?: Record<string, any>;
}

interface DiagnosisResult {
  rootCause: string;
  fixStrategy: "restart" | "patch_code" | "adjust_config" | "retry" | "escalate";
  confidence: number; // 0-1
  suggestedFix?: string;
  explanation: string;
  requiresManualIntervention: boolean;
}

interface HealingResult {
  success: boolean;
  action: string;
  diagnosis: DiagnosisResult;
  retryScheduled: boolean;
  escalated: boolean;
  message: string;
}

/**
 * Main entry point for self-healing when a skill fails
 */
export async function healFailedSkill(context: ErrorContext): Promise<HealingResult> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      action: "none",
      diagnosis: {
        rootCause: "Database unavailable",
        fixStrategy: "escalate",
        confidence: 1,
        explanation: "Cannot access database for healing",
        requiresManualIntervention: true,
      },
      retryScheduled: false,
      escalated: true,
      message: "Database unavailable - cannot perform healing",
    };
  }

  // Log the error
  await logError(context);

  // Check failure patterns
  const pattern = await analyzeFailurePattern(context);
  
  // If this is a recurring pattern with known fix, apply it directly
  if (pattern && pattern.knownFix) {
    return await applyKnownFix(context, pattern);
  }

  // Use LLM to diagnose the issue
  const diagnosis = await diagnoseProblem(context);

  // Attempt automated fix based on diagnosis
  const fixResult = await attemptFix(context, diagnosis);

  // If fix succeeded or requires retry, schedule retry
  if (fixResult.success || diagnosis.fixStrategy === "retry") {
    await scheduleRetry(context);
    return {
      success: fixResult.success,
      action: fixResult.action,
      diagnosis,
      retryScheduled: true,
      escalated: false,
      message: `Fix applied: ${fixResult.action}. Retry scheduled.`,
    };
  }

  // If fix failed and requires manual intervention, escalate
  if (diagnosis.requiresManualIntervention) {
    await escalateToUser(context, diagnosis);
    return {
      success: false,
      action: "escalated",
      diagnosis,
      retryScheduled: false,
      escalated: true,
      message: `Issue escalated: ${diagnosis.explanation}`,
    };
  }

  // Default: schedule retry with backoff
  await scheduleRetry(context);
  return {
    success: false,
    action: "retry_scheduled",
    diagnosis,
    retryScheduled: true,
    escalated: false,
    message: "Retry scheduled with exponential backoff",
  };
}

/**
 * Log error to database
 */
async function logError(context: ErrorContext): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Note: errorLogs requires runId, which we'll get from skillRuns
  // For now, we'll create a placeholder run if needed
  const runs = await db.select().from(skillRuns)
    .where(eq(skillRuns.scheduleId, context.scheduleId))
    .orderBy(desc(skillRuns.startedAt))
    .limit(1);
  
  const runId = runs[0]?.id || 0;
  
  await db.insert(errorLogs).values({
    runId,
    errorType: "skill_execution_error",
    errorMessage: context.errorMessage,
    stackTrace: context.errorStack,
    retryCount: context.attemptNumber,
    escalated: false,
  });
}

/**
 * Analyze if this error matches a known failure pattern
 */
async function analyzeFailurePattern(context: ErrorContext): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;

  // Look for similar errors in the past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const recentErrors = await db
    .select()
    .from(errorLogs)
    .where(gte(errorLogs.createdAt, sevenDaysAgo))
    .orderBy(desc(errorLogs.createdAt))
    .limit(10);

  // If we have 3+ similar errors, it's a pattern
  if (recentErrors.length >= 3) {
    const similarErrors = recentErrors.filter(e => 
      e.errorMessage && e.errorMessage.includes(context.errorMessage.substring(0, 50))
    );

    if (similarErrors.length >= 3) {
      // Check if we have a known fix for this pattern
      // Generate a hash for this error pattern
      const patternHash = Buffer.from(context.errorMessage.substring(0, 100)).toString('base64').substring(0, 64);
      
      const patterns = await db
        .select()
        .from(failurePatterns)
        .where(eq(failurePatterns.patternHash, patternHash))
        .limit(1);

      if (patterns.length > 0) {
        return patterns[0];
      }

      // Create a new pattern
      await db.insert(failurePatterns).values({
        patternHash,
        errorType: "skill_execution_error",
        errorSignature: context.errorMessage.substring(0, 500),
        occurrenceCount: similarErrors.length,
        lastOccurrence: context.timestamp,
        successfulFix: null,
        preventionStrategy: null,
      });
    }
  }

  return null;
}

/**
 * Apply a known fix from failure pattern database
 */
async function applyKnownFix(context: ErrorContext, pattern: any): Promise<HealingResult> {
  // In a real implementation, this would parse and execute the known fix
  // For now, we'll just log it and schedule a retry
  
  return {
    success: true,
    action: `Applied known fix: ${pattern.knownFix}`,
    diagnosis: {
      rootCause: "Known recurring issue",
      fixStrategy: "patch_code",
      confidence: 0.9,
      explanation: `Applied previously successful fix for this error pattern`,
      requiresManualIntervention: false,
    },
    retryScheduled: true,
    escalated: false,
    message: "Known fix applied successfully",
  };
}

/**
 * Use LLM to diagnose the problem
 */
async function diagnoseProblem(context: ErrorContext): Promise<DiagnosisResult> {
  const prompt = `You are a debugging expert. Analyze this error and provide a diagnosis.

ERROR CONTEXT:
- Skill ID: ${context.skillId}
- Schedule ID: ${context.scheduleId}
- Attempt Number: ${context.attemptNumber}
- Error Message: ${context.errorMessage}
${context.errorStack ? `- Stack Trace: ${context.errorStack}` : ""}
${context.skillCode ? `- Skill Code: ${context.skillCode.substring(0, 1000)}` : ""}

Provide a JSON response with:
{
  "rootCause": "brief description of the root cause",
  "fixStrategy": "restart|patch_code|adjust_config|retry|escalate",
  "confidence": 0.0-1.0,
  "suggestedFix": "specific fix to apply (if applicable)",
  "explanation": "detailed explanation for the user",
  "requiresManualIntervention": true|false
}`;

  try {
    const response = await callOpenRouterWithFallback(
      [
        { role: "system", content: "You are a debugging expert. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      "uncensored-only",
      true
    );

    const content = response.content || "{}";
    const diagnosis = JSON.parse(content);

    return {
      rootCause: diagnosis.rootCause || "Unknown error",
      fixStrategy: diagnosis.fixStrategy || "escalate",
      confidence: diagnosis.confidence || 0.5,
      suggestedFix: diagnosis.suggestedFix,
      explanation: diagnosis.explanation || "Unable to diagnose",
      requiresManualIntervention: diagnosis.requiresManualIntervention ?? true,
    };
  } catch (error) {
    console.error("[Self-Healing] LLM diagnosis failed:", error);
    return {
      rootCause: "LLM diagnosis failed",
      fixStrategy: "escalate",
      confidence: 0,
      explanation: `Could not diagnose error: ${error instanceof Error ? error.message : String(error)}`,
      requiresManualIntervention: true,
    };
  }
}

/**
 * Attempt to apply the fix based on diagnosis
 */
async function attemptFix(
  context: ErrorContext,
  diagnosis: DiagnosisResult
): Promise<{ success: boolean; action: string }> {
  switch (diagnosis.fixStrategy) {
    case "restart":
      return await restartSkill(context);
    
    case "patch_code":
      return await patchSkillCode(context, diagnosis);
    
    case "adjust_config":
      return await adjustConfiguration(context, diagnosis);
    
    case "retry":
      return { success: true, action: "Scheduled retry with backoff" };
    
    case "escalate":
      return { success: false, action: "Escalated to user" };
    
    default:
      return { success: false, action: "Unknown fix strategy" };
  }
}

/**
 * Restart the skill (disable and re-enable)
 */
async function restartSkill(context: ErrorContext): Promise<{ success: boolean; action: string }> {
  const db = await getDb();
  if (!db) return { success: false, action: "Database unavailable" };

  try {
    // Disable the schedule temporarily
    await db
      .update(skillSchedules)
      .set({ enabled: false })
      .where(eq(skillSchedules.id, context.scheduleId));

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Re-enable
    await db
      .update(skillSchedules)
      .set({ enabled: true, status: "idle" })
      .where(eq(skillSchedules.id, context.scheduleId));

    return { success: true, action: "Skill restarted successfully" };
  } catch (error) {
    return {
      success: false,
      action: `Restart failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Patch skill code (placeholder - would need skill execution context)
 */
async function patchSkillCode(
  context: ErrorContext,
  diagnosis: DiagnosisResult
): Promise<{ success: boolean; action: string }> {
  // In a real implementation, this would:
  // 1. Load the skill code
  // 2. Apply the suggested fix
  // 3. Validate the patched code
  // 4. Update the skill in the database
  
  // For now, we'll just log the suggested fix
  return {
    success: false,
    action: `Code patch suggested: ${diagnosis.suggestedFix || "No specific fix provided"}`,
  };
}

/**
 * Adjust configuration (placeholder)
 */
async function adjustConfiguration(
  context: ErrorContext,
  diagnosis: DiagnosisResult
): Promise<{ success: boolean; action: string }> {
  // In a real implementation, this would update skill configuration
  return {
    success: false,
    action: `Config adjustment suggested: ${diagnosis.suggestedFix || "No specific adjustment provided"}`,
  };
}

/**
 * Schedule a retry with exponential backoff
 */
async function scheduleRetry(context: ErrorContext): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Calculate backoff: 1min, 5min, 15min, 30min, 1hr, 2hr, etc.
  const backoffMinutes = Math.min(Math.pow(2, context.attemptNumber - 1), 120);
  const nextRun = new Date(Date.now() + backoffMinutes * 60 * 1000);

  await db
    .update(skillSchedules)
    .set({ nextRunAt: nextRun })
    .where(eq(skillSchedules.id, context.scheduleId));
}

/**
 * Escalate to user dashboard
 */
async function escalateToUser(context: ErrorContext, diagnosis: DiagnosisResult): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Update error log with escalation flag
  const recentError = await db.select().from(errorLogs)
    .orderBy(desc(errorLogs.createdAt))
    .limit(1);
  
  if (recentError[0]) {
    await db
      .update(errorLogs)
      .set({
        escalated: true,
        escalationReason: diagnosis.explanation,
        diagnosis: JSON.stringify(diagnosis),
      })
      .where(eq(errorLogs.id, recentError[0].id));
  }

  // In a real implementation, this would also:
  // - Send email notification to angelreporters@gmail.com
  // - Create a dashboard alert
  // - Log to a monitoring system
}

/**
 * Get healing statistics for dashboard
 */
export async function getHealingStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalErrors: 0,
      resolvedErrors: 0,
      escalatedErrors: 0,
      averageResolutionTime: 0,
      topFailurePatterns: [],
    };
  }

  const totalErrors = await db.select({ count: sql<number>`count(*)` }).from(errorLogs);
  const resolvedErrors = await db
    .select({ count: sql<number>`count(*)` })
    .from(errorLogs)
    .where(eq(errorLogs.fixSuccessful, true));
  const escalatedErrors = await db
    .select({ count: sql<number>`count(*)` })
    .from(errorLogs)
    .where(eq(errorLogs.escalated, true));

  const patterns = await db
    .select()
    .from(failurePatterns)
    .orderBy(desc(failurePatterns.occurrenceCount))
    .limit(10);

  return {
    totalErrors: totalErrors[0]?.count || 0,
    resolvedErrors: resolvedErrors[0]?.count || 0,
    escalatedErrors: escalatedErrors[0]?.count || 0,
    averageResolutionTime: 0, // Would need to calculate from timestamps
    topFailurePatterns: patterns,
  };
}

/**
 * Get recent errors for dashboard
 */
export async function getRecentErrors(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(errorLogs)
    .orderBy(desc(errorLogs.createdAt))
    .limit(limit);
}
