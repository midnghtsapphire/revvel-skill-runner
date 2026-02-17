/**
 * LLM Model Routing with OpenRouter
 * Handles model selection, fallback chains, rate limiting, and cost tracking
 */

interface LlmModelConfig {
  modelId: string;
  tier: "free-uncensored" | "paid-uncensored" | "free-censored" | "paid-censored";
  censored: boolean;
  costPerMTok: number;
  costPerCTok: number;
  description?: string;
  contextWindow?: number;
}

// OpenRouter model catalog
export const LLM_MODELS: Record<string, LlmModelConfig> = {
  "venice/uncensored:free": {
    modelId: "venice/uncensored:free",
    tier: "free-uncensored",
    censored: false,
    costPerMTok: 0,
    costPerCTok: 0,
  },
  "cognitivecomputations/dolphin-mistral-24b-venice-edition:free": {
    modelId: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    tier: "free-uncensored",
    censored: false,
    costPerMTok: 0,
    costPerCTok: 0,
  },
  "cognitivecomputations/dolphin-3.0": {
    modelId: "cognitivecomputations/dolphin-3.0",
    tier: "paid-uncensored",
    censored: false,
    costPerMTok: 0.0005,
    costPerCTok: 0.0015,
  },
  "venice/venice-ai-pro": {
    modelId: "venice/venice-ai-pro",
    tier: "paid-uncensored",
    censored: false,
    costPerMTok: 0.0008,
    costPerCTok: 0.0024,
  },
  "nous-hermes-3": {
    modelId: "nous-hermes-3",
    tier: "paid-uncensored",
    censored: false,
    costPerMTok: 0.0006,
    costPerCTok: 0.0018,
  },
  "mimo-v2-flash": {
    modelId: "mimo-v2-flash",
    tier: "free-censored",
    censored: true,
    costPerMTok: 0,
    costPerCTok: 0,
  },
  "trinity-large-preview": {
    modelId: "trinity-large-preview",
    tier: "free-censored",
    censored: true,
    costPerMTok: 0,
    costPerCTok: 0,
  },
  "meta-llama/llama-3.3-70b-instruct": {
    modelId: "meta-llama/llama-3.3-70b-instruct",
    tier: "free-censored",
    censored: true,
    costPerMTok: 0,
    costPerCTok: 0,
  },
  "moonshot/kimi-k2.5": {
    modelId: "moonshot/kimi-k2.5",
    tier: "paid-censored",
    censored: true,
    costPerMTok: 0.001,
    costPerCTok: 0.003,
  },
  "google/gemini-2.5-pro": {
    modelId: "google/gemini-2.5-pro",
    tier: "paid-censored",
    censored: true,
    costPerMTok: 0.0015,
    costPerCTok: 0.006,
  },
  "deepseek/deepseek-v3.2": {
    modelId: "deepseek/deepseek-v3.2",
    tier: "paid-censored",
    censored: true,
    costPerMTok: 0.0002,
    costPerCTok: 0.0006,
  },
};

// Default fallback chains per tier
const FALLBACK_CHAINS: Record<string, string[]> = {
  "free-first": [
    "venice/uncensored:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "mimo-v2-flash",
    "trinity-large-preview",
    "meta-llama/llama-3.3-70b-instruct",
  ],
  "paid-first": [
    "cognitivecomputations/dolphin-3.0",
    "deepseek/deepseek-v3.2",
    "nous-hermes-3",
    "venice/uncensored:free",
  ],
  "uncensored-only": [
    "venice/uncensored:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "cognitivecomputations/dolphin-3.0",
    "nous-hermes-3",
  ],
  "censored-only": [
    "mimo-v2-flash",
    "trinity-large-preview",
    "meta-llama/llama-3.3-70b-instruct",
    "moonshot/kimi-k2.5",
    "google/gemini-2.5-pro",
    "deepseek/deepseek-v3.2",
  ],
};

/**
 * Select best model based on preferences
 */
export function selectModel(
  tier: "free-first" | "paid-first" | "uncensored-only" | "censored-only" = "free-first",
  allowUncensored = true,
  allowCensored = true
): string {
  const chain = FALLBACK_CHAINS[tier] || FALLBACK_CHAINS["free-first"];
  
  for (const modelId of chain) {
    const model = LLM_MODELS[modelId];
    if (!model) continue;
    
    // Check censorship preference
    if (model.censored && !allowCensored) continue;
    if (!model.censored && !allowUncensored) continue;
    
    return modelId;
  }
  
  // Fallback to Venice Uncensored
  return "venice/uncensored:free";
}

/**
 * Calculate cost for API call
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = LLM_MODELS[modelId];
  if (!model) return 0;
  
  const inputCost = (inputTokens / 1000000) * model.costPerMTok;
  const outputCost = (outputTokens / 1000000) * model.costPerCTok;
  
  return inputCost + outputCost;
}

/**
 * Call OpenRouter API with model routing
 */
export async function callOpenRouter(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  modelId: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }
): Promise<{
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://revvel-skill-runner.manus.space",
      "X-Title": "Revvel Skill Runner",
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      top_p: options?.topP ?? 1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content || "";
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = calculateCost(modelId, inputTokens, outputTokens);

  return {
    content,
    inputTokens,
    outputTokens,
    cost,
    model: modelId,
  };
}

/**
 * Call with automatic fallback on rate limit
 */
export async function callOpenRouterWithFallback(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  tier: "free-first" | "paid-first" | "uncensored-only" | "censored-only" = "free-first",
  allowUncensored = true,
  allowCensored = true,
  maxRetries = 3
): Promise<{
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
  fallbackUsed: boolean;
}> {
  const chain = FALLBACK_CHAINS[tier] || FALLBACK_CHAINS["free-first"];
  let lastError: Error | null = null;
  let fallbackUsed = false;

  for (let i = 0; i < Math.min(maxRetries, chain.length); i++) {
    const modelId = chain[i];
    if (!modelId) continue;

    const model = LLM_MODELS[modelId];
    if (!model) continue;

    // Check censorship preference
    if (model.censored && !allowCensored) continue;
    if (!model.censored && !allowUncensored) continue;

    try {
      const result = await callOpenRouter(messages, modelId);
      if (i > 0) fallbackUsed = true;
      return { ...result, fallbackUsed };
    } catch (error) {
      lastError = error as Error;
      // Continue to next model in chain
      if (i > 0) fallbackUsed = true;
      continue;
    }
  }

  // All models failed
  throw lastError || new Error("All LLM models failed");
}
