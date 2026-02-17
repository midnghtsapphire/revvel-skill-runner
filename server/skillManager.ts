import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import { skills, skillSchedules, skillRuns } from "../drizzle/schema";

/**
 * Skill Management
 */
export async function getSkillByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(skills).where(eq(skills.name, name)).limit(1);
  return result[0] || null;
}

export async function listSkills(category?: string, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  
  const query = category 
    ? db.select().from(skills).where(eq(skills.category, category))
    : db.select().from(skills);
  
  return query.limit(limit).offset(offset);
}

export async function searchSkills(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db.select().from(skills).limit(limit * 2);
  const lowerQuery = query.toLowerCase();
  return results
    .filter(s => 
      s.name.toLowerCase().includes(lowerQuery) ||
      s.title.toLowerCase().includes(lowerQuery) ||
      (s.description?.toLowerCase().includes(lowerQuery) ?? false)
    )
    .slice(0, limit);
}

export async function getSkillCategories() {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db.select({ category: skills.category }).from(skills);
  const categories = new Set<string>();
  results.forEach((r: any) => {
    if (r.category) categories.add(r.category);
  });
  return Array.from(categories);
}

/**
 * Skill Scheduling
 */
export async function createSkillSchedule(
  skillId: number,
  userId: number,
  executionMode: "continuous" | "interval" | "one-time" | "cron",
  options: {
    intervalHours?: number;
    cronExpression?: string;
  }
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(skillSchedules).values({
    skillId,
    userId,
    enabled: true,
    executionMode,
    intervalHours: options.intervalHours,
    cronExpression: options.cronExpression,
    status: "scheduled",
    nextRunAt: new Date(),
  });

  return result;
}

export async function getScheduleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(skillSchedules).where(eq(skillSchedules.id, id)).limit(1);
  return result[0] || null;
}

export async function listSchedulesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(skillSchedules).where(eq(skillSchedules.userId, userId));
}

export async function updateScheduleStatus(
  scheduleId: number,
  status: "idle" | "running" | "scheduled" | "error" | "completed",
  nextRunAt?: Date
) {
  const db = await getDb();
  if (!db) return;

  await db.update(skillSchedules)
    .set({ status, nextRunAt: nextRunAt || new Date() })
    .where(eq(skillSchedules.id, scheduleId));
}

export async function toggleSchedule(scheduleId: number, enabled: boolean) {
  const db = await getDb();
  if (!db) return;

  await db.update(skillSchedules)
    .set({ enabled })
    .where(eq(skillSchedules.id, scheduleId));
}

/**
 * Skill Execution
 */
export async function createSkillRun(
  scheduleId: number,
  skillId: number
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(skillRuns).values({
    scheduleId,
    skillId,
    status: "running",
    startedAt: new Date(),
  });

  return result;
}

export async function getRunById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(skillRuns).where(eq(skillRuns.id, id)).limit(1);
  return result[0] || null;
}

export async function completeSkillRun(
  runId: number,
  status: "success" | "failed",
  output?: string,
  errorLog?: string
) {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const run = await getRunById(runId);
  if (!run) return;

  const duration = Math.floor((now.getTime() - run.startedAt.getTime()) / 1000);

  await db.update(skillRuns)
    .set({
      status,
      completedAt: now,
      duration,
      output,
      errorLog,
    })
    .where(eq(skillRuns.id, runId));
}

export async function listRunsForSchedule(scheduleId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(skillRuns)
    .where(eq(skillRuns.scheduleId, scheduleId))
    .orderBy(desc(skillRuns.startedAt))
    .limit(limit);
}
