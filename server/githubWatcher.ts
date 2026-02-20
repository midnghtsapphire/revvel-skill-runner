/**
 * GitHub Watcher
 * Auto-reviews MIDNGHTSAPPHIRE repositories hourly for:
 * - New inventions or Blue Ocean features
 * - Code quality issues
 * - Dependency updates needed
 * - Security vulnerabilities
 * - New commits or PRs
 * - Repos that need cleanup
 */

import { getDb } from "./db";
import { githubRepos, githubFindings } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { callOpenRouterWithFallback } from "./llmRouter";

const GITHUB_API = "https://api.github.com";
const GITHUB_OWNER = "MIDNGHTSAPPHIRE";

interface RepoData {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  lastPush: Date;
  defaultBranch: string;
}

interface Finding {
  repoId: number;
  type: "invention" | "blue-ocean" | "code-quality" | "dependency" | "security" | "commit" | "pr" | "cleanup";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  recommendation: string;
  metadata?: Record<string, any>;
}

/**
 * Main entry point - scan all MIDNGHTSAPPHIRE repos
 */
export async function scanAllRepos(): Promise<{
  scannedCount: number;
  findingsCount: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) {
    return { scannedCount: 0, findingsCount: 0, errors: ["Database unavailable"] };
  }

  const errors: string[] = [];
  let scannedCount = 0;
  let findingsCount = 0;

  try {
    // Fetch all repos from GitHub
    const repos = await fetchUserRepos();
    
    for (const repo of repos) {
      try {
        // Upsert repo to database
        const repoId = await upsertRepo(repo);
        
        // Scan the repo
        const findings = await scanRepo(repo, repoId);
        
        // Save findings
        for (const finding of findings) {
          await saveFinding(finding);
          findingsCount++;
        }
        
        scannedCount++;
      } catch (error) {
        errors.push(`Error scanning ${repo.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    errors.push(`Error fetching repos: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { scannedCount, findingsCount, errors };
}

/**
 * Fetch all repos for MIDNGHTSAPPHIRE user
 */
async function fetchUserRepos(): Promise<RepoData[]> {
  // Note: In production, you'd need a GitHub token for higher rate limits
  // For now, using public API
  
  const response = await fetch(`${GITHUB_API}/users/${GITHUB_OWNER}/repos?per_page=100&sort=updated`, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Revvel-Skill-Runner",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const repos = await response.json();
  
  return repos.map((repo: any) => ({
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    lastPush: new Date(repo.pushed_at),
    defaultBranch: repo.default_branch,
  }));
}

/**
 * Upsert repo to database
 */
async function upsertRepo(repo: RepoData): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Check if repo exists
  const existing = await db
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.repoName, repo.fullName))
    .limit(1);

  if (existing.length > 0) {
    // Update
    await db
      .update(githubRepos)
      .set({
        lastCheckedAt: new Date(),
        issuesCount: repo.openIssues,
        metadata: {
          description: repo.description,
          language: repo.language,
          stars: repo.stars,
          forks: repo.forks,
          lastPush: repo.lastPush.toISOString(),
        },
      })
      .where(eq(githubRepos.id, existing[0].id));
    
    return existing[0].id;
  } else {
    // Insert
    await db.insert(githubRepos).values({
      repoName: repo.fullName,
      owner: GITHUB_OWNER,
      lastCheckedAt: new Date(),
      issuesCount: repo.openIssues,
      metadata: {
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        forks: repo.forks,
        lastPush: repo.lastPush.toISOString(),
      },
    });
    
    // Fetch the newly inserted repo
    const newRepo = await db
      .select()
      .from(githubRepos)
      .where(eq(githubRepos.repoName, repo.fullName))
      .limit(1);
    
    return newRepo[0]?.id || 0;
  }
}

/**
 * Scan a single repo for findings
 */
async function scanRepo(repo: RepoData, repoId: number): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Check for new commits (last 24 hours)
  const commitFindings = await checkRecentCommits(repo, repoId);
  findings.push(...commitFindings);

  // 2. Check for open PRs
  const prFindings = await checkOpenPRs(repo, repoId);
  findings.push(...prFindings);

  // 3. Analyze repo for inventions/Blue Ocean features
  const inventionFindings = await analyzeForInventions(repo, repoId);
  findings.push(...inventionFindings);

  // 4. Check for dependency updates (if package.json exists)
  const depFindings = await checkDependencies(repo, repoId);
  findings.push(...depFindings);

  // 5. Check for security vulnerabilities
  const securityFindings = await checkSecurity(repo, repoId);
  findings.push(...securityFindings);

  // 6. Check if repo needs cleanup
  const cleanupFindings = await checkCleanup(repo, repoId);
  findings.push(...cleanupFindings);

  return findings;
}

/**
 * Check for recent commits
 */
async function checkRecentCommits(repo: RepoData, repoId: number): Promise<Finding[]> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const response = await fetch(
      `${GITHUB_API}/repos/${repo.fullName}/commits?since=${since}`,
      {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Revvel-Skill-Runner",
        },
      }
    );

    if (!response.ok) return [];

    const commits = await response.json();
    
    if (commits.length > 0) {
      return [{
        repoId,
        type: "commit" as const,
        severity: "low",
        title: `${commits.length} new commit(s) in last 24 hours`,
        description: commits.map((c: any) => c.commit.message).join("; "),
        recommendation: "Review recent changes",
        metadata: { commitCount: commits.length },
      }];
    }
  } catch (error) {
    console.error(`Error checking commits for ${repo.name}:`, error);
  }

  return [];
}

/**
 * Check for open PRs
 */
async function checkOpenPRs(repo: RepoData, repoId: number): Promise<Finding[]> {
  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${repo.fullName}/pulls?state=open`,
      {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Revvel-Skill-Runner",
        },
      }
    );

    if (!response.ok) return [];

    const prs = await response.json();
    
    if (prs.length > 0) {
      return [{
        repoId,
        type: "pr" as const,
        severity: "medium",
        title: `${prs.length} open pull request(s)`,
        description: prs.map((pr: any) => pr.title).join("; "),
        recommendation: "Review and merge or close PRs",
        metadata: { prCount: prs.length },
      }];
    }
  } catch (error) {
    console.error(`Error checking PRs for ${repo.name}:`, error);
  }

  return [];
}

/**
 * Analyze repo for inventions and Blue Ocean features using LLM
 */
async function analyzeForInventions(repo: RepoData, repoId: number): Promise<Finding[]> {
  try {
    // Fetch README to analyze
    const readmeResponse = await fetch(
      `${GITHUB_API}/repos/${repo.fullName}/readme`,
      {
        headers: {
          "Accept": "application/vnd.github.v3.raw",
          "User-Agent": "Revvel-Skill-Runner",
        },
      }
    );

    if (!readmeResponse.ok) return [];

    const readme = await readmeResponse.text();
    
    // Use LLM to analyze for inventions
    const prompt = `Analyze this GitHub repository for potential inventions or Blue Ocean features.

REPO: ${repo.name}
DESCRIPTION: ${repo.description || "No description"}
LANGUAGE: ${repo.language || "Unknown"}

README (first 2000 chars):
${readme.substring(0, 2000)}

Identify:
1. Novel features or approaches that could be patentable inventions
2. Blue Ocean strategy opportunities (uncontested market space)
3. Unique value propositions

Respond with JSON:
{
  "hasInvention": true|false,
  "inventionTitle": "brief title",
  "inventionDescription": "description",
  "blueOceanOpportunity": "description of market opportunity",
  "severity": "low|medium|high|critical",
  "recommendation": "what to do next"
}`;

    const response = await callOpenRouterWithFallback(
      [{ role: "user", content: prompt }],
      "uncensored-only",
      true
    );

    const analysis = JSON.parse(response.content);
    
    if (analysis.hasInvention) {
      return [{
        repoId,
        type: "invention",
        severity: analysis.severity || "medium",
        title: analysis.inventionTitle || "Potential invention detected",
        description: analysis.inventionDescription || "See analysis",
        recommendation: analysis.recommendation || "Consider patent filing",
        metadata: { blueOceanOpportunity: analysis.blueOceanOpportunity },
      }];
    }
  } catch (error) {
    console.error(`Error analyzing inventions for ${repo.name}:`, error);
  }

  return [];
}

/**
 * Check for dependency updates
 */
async function checkDependencies(repo: RepoData, repoId: number): Promise<Finding[]> {
  try {
    // Check if package.json exists
    const response = await fetch(
      `${GITHUB_API}/repos/${repo.fullName}/contents/package.json`,
      {
        headers: {
          "Accept": "application/vnd.github.v3.raw",
          "User-Agent": "Revvel-Skill-Runner",
        },
      }
    );

    if (!response.ok) return [];

    const packageJson = await response.text();
    const pkg = JSON.parse(packageJson);
    
    // In a real implementation, you'd check against npm registry for updates
    // For now, just flag if there are dependencies
    if (pkg.dependencies || pkg.devDependencies) {
      const depCount = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;
      
      return [{
        repoId,
        type: "dependency" as const,
        severity: "low",
        title: `${depCount} dependencies to review`,
        description: "Check for available updates",
        recommendation: "Run npm outdated or use Dependabot",
        metadata: { dependencyCount: depCount },
      }];
    }
  } catch (error) {
    // Silently ignore if package.json doesn't exist
  }

  return [];
}

/**
 * Check for security vulnerabilities
 */
async function checkSecurity(repo: RepoData, repoId: number): Promise<Finding[]> {
  try {
    // Check if Dependabot alerts are enabled (requires auth)
    // For now, just flag repos with open issues as potential security concerns
    if (repo.openIssues > 5) {
      return [{
        repoId,
        type: "security" as const,
        severity: "medium",
        title: `${repo.openIssues} open issues`,
        description: "High number of open issues may indicate security or quality concerns",
        recommendation: "Review and triage open issues",
        metadata: { issueCount: repo.openIssues },
      }];
    }
  } catch (error) {
    console.error(`Error checking security for ${repo.name}:`, error);
  }

  return [];
}

/**
 * Check if repo needs cleanup
 */
async function checkCleanup(repo: RepoData, repoId: number): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Check if repo hasn't been updated in 6 months
  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
  if (repo.lastPush < sixMonthsAgo) {
    findings.push({
      repoId,
      type: "cleanup" as const,
      severity: "low",
      title: "Stale repository",
      description: `No commits in ${Math.floor((Date.now() - repo.lastPush.getTime()) / (30 * 24 * 60 * 60 * 1000))} months`,
      recommendation: "Archive or delete if no longer needed",
      metadata: { lastPush: repo.lastPush.toISOString() },
    });
  }

  // Check if repo has no description
  if (!repo.description) {
    findings.push({
      repoId,
      type: "cleanup" as const,
      severity: "low",
      title: "Missing description",
      description: "Repository has no description",
      recommendation: "Add a clear description",
    });
  }

  return findings;
}

/**
 * Save finding to database
 */
async function saveFinding(finding: Finding): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(githubFindings).values({
    repoId: finding.repoId,
    findingType: finding.type,
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    resolved: false,
  });
}

/**
 * Get recent findings for dashboard
 */
export async function getRecentFindings(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(githubFindings)
    .orderBy(desc(githubFindings.createdAt))
    .limit(limit);
}

/**
 * Get findings by type
 */
export async function getFindingsByType(type: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(githubFindings)
    .where(eq(githubFindings.findingType, type as any))
    .orderBy(desc(githubFindings.createdAt))
    .limit(50);
}

/**
 * Get all monitored repos
 */
export async function getMonitoredRepos() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(githubRepos)
    .orderBy(desc(githubRepos.lastCheckedAt))
    .limit(100);
}

/**
 * Mark finding as resolved
 */
export async function resolveFinding(findingId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(githubFindings)
    .set({ resolved: true })
    .where(eq(githubFindings.id, findingId));
}
