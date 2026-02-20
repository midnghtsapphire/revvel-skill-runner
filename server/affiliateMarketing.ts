/**
 * Affiliate Marketing Automation
 * - Manages affiliate links across platforms
 * - Auto-generates marketing content
 * - Schedules social media posts
 * - Tracks conversions and revenue
 * - A/B testing and optimization
 */

import { getDb } from "./db";
import { affiliateLinks, socialPosts } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { callOpenRouterWithFallback } from "./llmRouter";

interface AffiliateLink {
  platform: string;
  productName: string;
  productUrl: string;
  affiliateUrl: string;
  shortCode?: string;
}

interface SocialPost {
  platform: "tiktok" | "instagram" | "facebook" | "twitter" | "linkedin";
  content: string;
  mediaUrl?: string;
  affiliateLinkId: number;
  scheduledFor?: Date;
}

interface ContentVariant {
  headline: string;
  body: string;
  cta: string;
  tone: "professional" | "casual" | "humorous" | "urgent";
}

/**
 * Create a new affiliate link
 */
export async function createAffiliateLink(link: AffiliateLink): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Generate short code if not provided
  const shortCode = link.shortCode || generateShortCode();

  const result = await db.insert(affiliateLinks).values({
    platform: link.platform,
    productName: link.productName,
    productUrl: link.productUrl,
    affiliateUrl: link.affiliateUrl,
    shortCode,
    clicks: 0,
    conversions: 0,
    revenue: 0,
  });

  // Fetch the newly inserted link
  const newLink = await db
    .select()
    .from(affiliateLinks)
    .where(eq(affiliateLinks.shortCode, shortCode))
    .limit(1);

  return newLink[0]?.id || 0;
}

/**
 * Generate marketing content for a product
 */
export async function generateMarketingContent(
  productName: string,
  productDescription: string,
  platform: string
): Promise<ContentVariant[]> {
  const prompt = `Generate 3 marketing content variants for an affiliate product.

PRODUCT: ${productName}
DESCRIPTION: ${productDescription}
PLATFORM: ${platform}

Create 3 variants with different tones:
1. Professional/authoritative
2. Casual/friendly
3. Urgent/FOMO-driven

Each variant should include:
- Headline (attention-grabbing, 10-15 words)
- Body (2-3 sentences highlighting benefits)
- CTA (call-to-action, 5-8 words)

Respond with JSON array:
[
  {
    "headline": "...",
    "body": "...",
    "cta": "...",
    "tone": "professional|casual|humorous|urgent"
  }
]`;

  try {
    const response = await callOpenRouterWithFallback(
      [{ role: "user", content: prompt }],
      "free-first",
      true
    );

    const variants: ContentVariant[] = JSON.parse(response.content);
    return variants;
  } catch (error) {
    console.error("Error generating marketing content:", error);
    throw error;
  }
}

/**
 * Schedule a social media post
 */
export async function scheduleSocialPost(post: SocialPost): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db.insert(socialPosts).values({
    platform: post.platform,
    content: post.content,
    mediaUrls: post.mediaUrl ? [post.mediaUrl] : null,
    affiliateLinkId: post.affiliateLinkId,
    scheduledFor: post.scheduledFor || new Date(),
    status: "scheduled",
  });

  // Fetch the newly inserted post
  const newPost = await db
    .select()
    .from(socialPosts)
    .orderBy(desc(socialPosts.createdAt))
    .limit(1);

  return newPost[0]?.id || 0;
}

/**
 * Track affiliate link click
 */
export async function trackClick(shortCode: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(affiliateLinks)
    .set({
      clicks: sql`clicks + 1`,
      lastClickAt: new Date(),
    })
    .where(eq(affiliateLinks.shortCode, shortCode));
}

/**
 * Track conversion
 */
export async function trackConversion(
  shortCode: string,
  revenue: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(affiliateLinks)
    .set({
      conversions: sql`conversions + 1`,
      revenue: sql`revenue + ${revenue}`,
    })
    .where(eq(affiliateLinks.shortCode, shortCode));
}

/**
 * Get top-performing affiliate links
 */
export async function getTopPerformers(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(affiliateLinks)
    .orderBy(desc(affiliateLinks.revenue))
    .limit(limit);
}

/**
 * Get affiliate link analytics
 */
export async function getAffiliateAnalytics() {
  const db = await getDb();
  if (!db) {
    return {
      totalLinks: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      conversionRate: 0,
    };
  }

  const stats = await db
    .select({
      totalLinks: sql<number>`COUNT(*)`,
      totalClicks: sql<number>`SUM(clicks)`,
      totalConversions: sql<number>`SUM(conversions)`,
      totalRevenue: sql<number>`SUM(revenue)`,
    })
    .from(affiliateLinks);

  const result = stats[0] || {
    totalLinks: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalRevenue: 0,
  };

  const conversionRate =
    result.totalClicks > 0
      ? (result.totalConversions / result.totalClicks) * 100
      : 0;

  return {
    ...result,
    conversionRate,
  };
}

/**
 * A/B test content variants
 */
export async function createABTest(
  affiliateLinkId: number,
  variants: ContentVariant[]
): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const postIds: number[] = [];

  for (const variant of variants) {
    const content = `${variant.headline}\n\n${variant.body}\n\n${variant.cta}`;
    
    await db.insert(socialPosts).values({
      platform: "facebook", // Default platform for A/B testing
      content,
      affiliateLinkId,
      scheduledFor: new Date(),
      status: "scheduled",
      abTestVariant: variant.tone,
    });

    const newPost = await db
      .select()
      .from(socialPosts)
      .orderBy(desc(socialPosts.createdAt))
      .limit(1);

    if (newPost[0]) {
      postIds.push(newPost[0].id);
    }
  }

  return postIds;
}

/**
 * Get A/B test results
 */
export async function getABTestResults(affiliateLinkId: number) {
  const db = await getDb();
  if (!db) return [];

  const posts = await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.affiliateLinkId, affiliateLinkId));

  // Group by A/B test group and calculate metrics
  const results = posts.reduce((acc: any[], post) => {
    const group = post.abTestVariant || "control";
    const existing = acc.find((r) => r.group === group);
    
    const engagement = post.engagement || {};
    const clicks = engagement.clicks || 0;
    const likes = engagement.likes || 0;
    const shares = engagement.shares || 0;
    const comments = engagement.comments || 0;

    if (existing) {
      existing.posts++;
      existing.clicks += clicks;
      existing.likes += likes;
      existing.shares += shares;
      existing.comments += comments;
    } else {
      acc.push({
        group,
        posts: 1,
        clicks,
        likes,
        shares,
        comments,
      });
    }

    return acc;
  }, []);

  // Calculate engagement metrics
  return results.map((r) => ({
    ...r,
    totalEngagement: r.likes + r.shares + r.comments,
    avgClicksPerPost: r.posts > 0 ? r.clicks / r.posts : 0,
  }));
}

/**
 * Get scheduled posts
 */
export async function getScheduledPosts(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.status, "scheduled"))
    .orderBy(socialPosts.scheduledFor)
    .limit(limit);
}

/**
 * Mark post as posted
 */
export async function markPostAsPosted(postId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(socialPosts)
    .set({
      status: "posted",
      postedAt: new Date(),
    })
    .where(eq(socialPosts.id, postId));
}

/**
 * Update post metrics
 */
export async function updatePostMetrics(
  postId: number,
  metrics: {
    likes?: number;
    shares?: number;
    comments?: number;
    clicks?: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(socialPosts)
    .set({
      engagement: metrics,
    })
    .where(eq(socialPosts.id, postId));
}

/**
 * Generate short code for affiliate link
 */
function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get all affiliate links
 */
export async function getAllAffiliateLinks() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(affiliateLinks)
    .orderBy(desc(affiliateLinks.createdAt))
    .limit(100);
}

/**
 * Get affiliate link by short code
 */
export async function getAffiliateLinkByShortCode(shortCode: string) {
  const db = await getDb();
  if (!db) return null;

  const links = await db
    .select()
    .from(affiliateLinks)
    .where(eq(affiliateLinks.shortCode, shortCode))
    .limit(1);

  return links[0] || null;
}
