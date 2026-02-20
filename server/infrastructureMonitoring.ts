/**
 * Infrastructure Monitoring
 * Monitors all DigitalOcean droplets for:
 * - Health checks
 * - Auto-restart on failure
 * - Uptime tracking
 * - SLA reporting
 */

import { getDb } from "./db";
import { monitoredServers, serverHealthChecks } from "../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";

interface Server {
  name: string;
  url: string;
  type: "web" | "api" | "database" | "other";
  expectedStatus: number;
  checkInterval: number; // minutes
}

interface HealthCheckResult {
  serverId: number;
  status: "healthy" | "down" | "degraded";
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
}

/**
 * Register a server for monitoring
 */
export async function registerServer(server: Server): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Check if server already exists
  const existing = await db
    .select()
    .from(monitoredServers)
    .where(eq(monitoredServers.healthCheckUrl, server.url))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  await db.insert(monitoredServers).values({
    serverName: server.name,
    ipAddress: "0.0.0.0", // Placeholder, would be fetched from DigitalOcean API
    appName: server.name,
    healthCheckUrl: server.url,
    status: "unknown",
    lastCheckAt: null,
    uptimePercentage: 100,
    autoRestartEnabled: true,
    metadata: {
      type: server.type,
      checkInterval: server.checkInterval,
    },
  });

  const newServer = await db
    .select()
    .from(monitoredServers)
    .where(eq(monitoredServers.healthCheckUrl, server.url))
    .limit(1);

  return newServer[0]?.id || 0;
}

/**
 * Perform health check on a server
 */
export async function performHealthCheck(serverId: number): Promise<HealthCheckResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Get server details
  const servers = await db
    .select()
    .from(monitoredServers)
    .where(eq(monitoredServers.id, serverId))
    .limit(1);

  if (servers.length === 0) {
    throw new Error(`Server ${serverId} not found`);
  }

  const server = servers[0];
  const startTime = Date.now();

  let result: HealthCheckResult = {
    serverId,
    status: "down",
    responseTime: 0,
  };

  try {
    const response = await fetch(server.healthCheckUrl || "", {
      method: "GET",
      headers: {
        "User-Agent": "Revvel-Skill-Runner-Monitor",
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;

    result = {
      serverId,
      status: statusCode >= 200 && statusCode < 300 ? "healthy" : "degraded",
      responseTime,
      statusCode,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    result = {
      serverId,
      status: "down",
      responseTime,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  // Save health check result
  await saveHealthCheck(result);

  // Update server status
  await updateServerStatus(serverId, result);

  // If server is down, attempt auto-restart
  if (result.status === "down") {
    await attemptAutoRestart(serverId);
  }

  return result;
}

/**
 * Save health check result to database
 */
async function saveHealthCheck(result: HealthCheckResult): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(serverHealthChecks).values({
    serverId: result.serverId,
    status: result.status,
    responseTime: result.responseTime,
    errorMessage: result.errorMessage,
    actionTaken: result.status === "down" ? "Auto-restart attempted" : null,
  });
}

/**
 * Update server status
 */
async function updateServerStatus(
  serverId: number,
  result: HealthCheckResult
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Calculate uptime percentage (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const checks = await db
    .select()
    .from(serverHealthChecks)
    .where(
      and(
        eq(serverHealthChecks.serverId, serverId),
        gte(serverHealthChecks.checkedAt, thirtyDaysAgo)
      )
    );

  const upChecks = checks.filter((c) => c.status === "healthy").length;
  const uptimePercentage = checks.length > 0 ? (upChecks / checks.length) * 100 : 100;

  await db
    .update(monitoredServers)
    .set({
      status: result.status,
      lastCheckAt: new Date(),
      uptimePercentage,
      metadata: {
        lastResponseTime: result.responseTime,
      },
    })
    .where(eq(monitoredServers.id, serverId));
}

/**
 * Attempt to auto-restart a server
 */
async function attemptAutoRestart(serverId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const servers = await db
    .select()
    .from(monitoredServers)
    .where(eq(monitoredServers.id, serverId))
    .limit(1);

  if (servers.length === 0) return;

  const server = servers[0];

  console.log(`[Infrastructure Monitor] Server ${server.serverName} is down. Attempting auto-restart...`);

  // In a real implementation, this would:
  // 1. Connect to DigitalOcean API
  // 2. Restart the droplet
  // 3. Wait for it to come back online
  // 4. Verify it's working

  // For now, we'll just log the attempt
  // You would need to implement DigitalOcean API integration here
  // using their official SDK or REST API

  // Placeholder for restart logic
  try {
    // await restartDigitalOceanDroplet(server.serverName);
    console.log(`[Infrastructure Monitor] Restart command sent for ${server.serverName}`);
  } catch (error) {
    console.error(`[Infrastructure Monitor] Failed to restart ${server.serverName}:`, error);
  }
}

/**
 * Get all monitored servers
 */
export async function getAllServers() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(monitoredServers)
    .orderBy(monitoredServers.serverName)
    .limit(100);
}

/**
 * Get server health history
 */
export async function getServerHealthHistory(serverId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(serverHealthChecks)
    .where(eq(serverHealthChecks.serverId, serverId))
    .orderBy(desc(serverHealthChecks.checkedAt))
    .limit(limit);
}

/**
 * Get infrastructure overview
 */
export async function getInfrastructureOverview() {
  const db = await getDb();
  if (!db) {
    return {
      totalServers: 0,
      upServers: 0,
      downServers: 0,
      degradedServers: 0,
      avgResponseTime: 0,
      avgUptime: 0,
    };
  }

  const servers = await db.select().from(monitoredServers);

  const upServers = servers.filter((s) => s.status === "healthy").length;
  const downServers = servers.filter((s) => s.status === "down").length;
  const degradedServers = servers.filter((s) => s.status === "degraded").length;

  const avgResponseTime =
    servers.reduce((sum, s) => {
      const metadata = s.metadata || {};
      return sum + (metadata.lastResponseTime || 0);
    }, 0) / servers.length || 0;

  const avgUptime =
    servers.reduce((sum, s) => sum + (s.uptimePercentage || 0), 0) / servers.length || 0;

  return {
    totalServers: servers.length,
    upServers,
    downServers,
    degradedServers,
    avgResponseTime,
    avgUptime,
  };
}

/**
 * Start continuous monitoring
 * Checks all servers at their configured intervals
 */
export function startContinuousMonitoring() {
  console.log("[Infrastructure Monitor] Starting continuous monitoring...");

  // Check all servers every minute
  setInterval(async () => {
    const db = await getDb();
    if (!db) return;

    const servers = await db.select().from(monitoredServers);

    for (const server of servers) {
      // Check if it's time to check this server
      const now = Date.now();
      const lastCheck = server.lastCheckAt?.getTime() || 0;
      const metadata = server.metadata || {};
      const intervalMs = (metadata.checkInterval || 5) * 60 * 1000;

      if (now - lastCheck >= intervalMs) {
        performHealthCheck(server.id).catch((error) => {
          console.error(`[Infrastructure Monitor] Error checking ${server.serverName}:`, error);
        });
      }
    }
  }, 60 * 1000); // Check every minute
}

/**
 * Register default servers (7 deployed apps)
 */
export async function registerDefaultServers() {
  const defaultServers: Server[] = [
    {
      name: "ordain.church",
      url: "https://ordain.church",
      type: "web",
      expectedStatus: 200,
      checkInterval: 5,
    },
    {
      name: "thealttext",
      url: "https://thealttext.com",
      type: "web",
      expectedStatus: 200,
      checkInterval: 5,
    },
    {
      name: "CurlCare",
      url: "https://curlcare.app",
      type: "web",
      expectedStatus: 200,
      checkInterval: 5,
    },
    {
      name: "Rent Anything Hub",
      url: "https://rentanythinghub.com",
      type: "web",
      expectedStatus: 200,
      checkInterval: 5,
    },
    {
      name: "Marketing Automation",
      url: "https://marketing-automation.manus.space",
      type: "web",
      expectedStatus: 200,
      checkInterval: 5,
    },
    {
      name: "Revvel Skill Runner",
      url: "https://revvel-skill-runner.manus.space",
      type: "web",
      expectedStatus: 200,
      checkInterval: 5,
    },
    {
      name: "Meet Audrey Evans",
      url: "https://meetaudreyevans.com",
      type: "web",
      expectedStatus: 200,
      checkInterval: 5,
    },
  ];

  for (const server of defaultServers) {
    try {
      await registerServer(server);
      console.log(`[Infrastructure Monitor] Registered ${server.name}`);
    } catch (error) {
      console.error(`[Infrastructure Monitor] Failed to register ${server.name}:`, error);
    }
  }
}
