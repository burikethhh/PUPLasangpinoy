// LasangPinoy AI Integration
// Vision/Scanner: Gemini Flash (primary) → OpenRouter → DashScope (fallbacks)
// Chat (Chef Pinoy): DashScope basic models only

import { Platform } from "react-native";
import { createLogger } from "./logger";

const log = createLogger("QwenAI");

const FALLBACK_DASHSCOPE_KEY = process.env.EXPO_PUBLIC_QWEN_API_KEY || "";
const FALLBACK_OPENROUTER_KEY =
  process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || "";

// ──────────────────────────────────────────────
// GOOGLE GEMINI PROVIDER (primary for vision)
// ──────────────────────────────────────────────

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_VISION_MODEL = "gemini-2.0-flash";

function getGeminiApiKey(): string {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
}

interface GeminiResponse {
  candidates?: { content: { parts: { text: string }[] } }[];
  error?: { message: string; code: number };
}

/**
 * Call Google Gemini for vision analysis. Returns the text response.
 */
async function callGeminiVision(
  systemPrompt: string,
  userText: string,
  base64Image: string,
  maxTokens: number = 1500,
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API key not configured");

  const url = `${GEMINI_BASE_URL}/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          parts: [
            { text: userText },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } },
          ],
        }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal: controller.signal,
    });

    const body = await response.text();

    if (!response.ok) {
      let message = `Gemini error (HTTP ${response.status})`;
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {}
      const err: any = new Error(message);
      err.status = response.status;
      err.isRateLimit = response.status === 429;
      err.isAuthError = response.status === 400 || response.status === 403;
      throw err;
    }

    const data: GeminiResponse = JSON.parse(body);
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response from Gemini");
    return text;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Gemini request timed out. Check your connection.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ──────────────────────────────────────────────
// PROVIDER CONFIGURATION
// ──────────────────────────────────────────────

interface Provider {
  name: string;
  baseUrl: string;
  /** process.env key containing the API key (read at call time, not module load) */
  envKey: string;
  /** Map from canonical model names to this provider's model name */
  modelMap: Record<string, string>;
}

/**
 * OpenRouter model names for Qwen models.
 * See https://openrouter.ai/models?q=qwen
 */
const OPENROUTER_MODEL_MAP: Record<string, string> = {
  "qwen-turbo":              "qwen/qwen-turbo",
  "qwen-turbo-latest":       "qwen/qwen-turbo",
  "qwen-plus":               "qwen/qwen-plus",
  "qwen-max":                "qwen/qwen-max",
  "qwen-vl-max":             "qwen/qwen2.5-vl-72b-instruct",
  "qwen-vl-max-latest":      "qwen/qwen2.5-vl-72b-instruct",
  "qwen3.6-plus-free":       "qwen/qwen3.6-plus:free",
  "nvidia-nemotron-vl-free": "nvidia/nemotron-nano-12b-v2-vl:free",
  // Qwen3 models on OpenRouter
  "qwen3-235b-a22b":         "qwen/qwen3-235b-a22b",
  "qwen3-30b-a3b":           "qwen/qwen3-30b-a3b",
  "qwen3-32b":               "qwen/qwen3-32b",
  "qwen3-14b":               "qwen/qwen3-14b",
};

/**
 * Provider registry — API keys are resolved from process.env at *call time*
 * (not module load time) so that test overrides and runtime updates are picked up.
 */
const PROVIDERS: Provider[] = [
  {
    name: "DashScope",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    envKey: "EXPO_PUBLIC_QWEN_API_KEY",
    modelMap: {},
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "EXPO_PUBLIC_OPENROUTER_API_KEY",
    modelMap: OPENROUTER_MODEL_MAP,
  },
];

/** Returns only providers that currently have a key set in process.env. */
function getAvailableProviders(order: "vision" | "chat" = "chat"): (Provider & { apiKey: string })[] {
  const isTest = process.env.NODE_ENV === "test";

  const all = PROVIDERS
    .map((p) => {
      const envValue = process.env[p.envKey] ?? "";
      if (envValue) return { ...p, apiKey: envValue };

      if (!isTest && p.envKey === "EXPO_PUBLIC_QWEN_API_KEY") {
        return { ...p, apiKey: FALLBACK_DASHSCOPE_KEY };
      }
      if (!isTest && p.envKey === "EXPO_PUBLIC_OPENROUTER_API_KEY") {
        return { ...p, apiKey: FALLBACK_OPENROUTER_KEY };
      }
      return { ...p, apiKey: "" };
    })
    .filter((p) => !!p.apiKey) as (Provider & { apiKey: string })[];

  // Vision/scanner: OpenRouter first, DashScope fallback
  // Chat: DashScope only (basic models)
  if (order === "vision") {
    return [...all].sort((a, b) =>
      a.name === "OpenRouter" ? -1 : b.name === "OpenRouter" ? 1 : 0,
    );
  }
  // Chat: DashScope only
  return all.filter((p) => p.name === "DashScope");
}

// ──────────────────────────────────────────────
// TYPE DEFINITIONS
// ──────────────────────────────────────────────

export interface QwenMessage {
  role: "system" | "user" | "assistant";
  content: string | QwenContentPart[];
}

export interface QwenContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface QwenResponse {
  choices: { message: { content: string } }[];
  error?: { message: string; code: string };
}

export interface ScanResult {
  type: "dish" | "ingredients" | "unknown";
  dishName?: string;
  confidence?: string;
  ingredients?: string[];
  description?: string;
  suggestedRecipes?: SuggestedRecipe[];
  funFact?: string;
  isFilipino?: boolean;
  nutrition?: NutritionInfo;
  servingSize?: string;
  cookingTips?: string;
}

export interface NutritionInfo {
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  fiber?: string;
  sodium?: string;
}

export interface SuggestedRecipe {
  name: string;
  description?: string;
  nutrition?: NutritionInfo;
  mainIngredients?: string[];
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

/**
 * Extract valid JSON from a model response that may contain markdown fences.
 * Handles ```json ... ```, ``` ... ```, or a bare {...} block.
 *
 * Exported for unit testing.
 */
export function extractJSON(text: string): string | null {
  // 1. Try to strip markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // 2. Find the outermost {...} block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);

  return null;
}

/**
 * Make a POST request to a single provider. Returns the content string.
 * Throws with `.isRateLimit = true` or `.isAuthError = true` for caller to handle.
 */
async function callProvider(
  provider: Provider & { apiKey: string },
  model: string,
  messages: QwenMessage[],
  maxTokens: number,
): Promise<string> {
  const resolvedModel = provider.modelMap[model] ?? model;

  // Vision models need more time (large image payloads)
  const isVisionModel = model.includes('vl');
  const timeoutMs = isVisionModel ? 60_000 : 30_000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    };
    // OpenRouter requires these for attribution
    if (provider.name === "OpenRouter") {
      headers["HTTP-Referer"] = "https://lasangpinoy.app";
      headers["X-Title"] = "LasangPinoy";
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: resolvedModel, messages, max_tokens: maxTokens }),
      signal: controller.signal,
    });

    if (!response) {
      throw new Error("No response from AI provider");
    }

    let body = "";
    if (typeof (response as any).text === "function") {
      body = await (response as any).text();
    } else if (typeof (response as any).json === "function") {
      const parsed = await (response as any).json();
      body = JSON.stringify(parsed ?? {});
    }

    if (!response.ok) {
      let message = `${provider.name} error (HTTP ${response.status})`;
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error?.message) message = parsed.error.message;
        else if (parsed?.message) message = parsed.message;
      } catch {}

      const err: any = new Error(message);
      err.status = response.status;
      err.isRateLimit = response.status === 429;
      err.isAuthError = response.status === 401 || response.status === 403;
      throw err;
    }

    const data: QwenResponse = JSON.parse(body);
    if (data.error) {
      throw new Error(data.error.message || "Unknown AI error");
    }
    return data.choices[0]?.message?.content || "";
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Check your internet connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call the AI API with automatic provider fallback.
 *
 * @param providerOrder – "vision" ⇒ OpenRouter first, DashScope fallback
 *                        "chat"   ⇒ DashScope only (basic models)
 */
async function callQwenAPI(
  model: string,
  messages: QwenMessage[],
  maxTokens: number,
  providerOrder: "vision" | "chat" = "chat",
): Promise<string> {
  if (Platform.OS === "web") {
    throw new Error(
      "AI features are not available in the web browser due to API restrictions. " +
        "Please use the mobile app (iOS or Android) for AI scanning and chat.",
    );
  }

  const availableProviders = getAvailableProviders(providerOrder);
  if (availableProviders.length === 0) {
    throw new Error(
      "AI is not configured. Please set EXPO_PUBLIC_QWEN_API_KEY or EXPO_PUBLIC_OPENROUTER_API_KEY in your .env file.",
    );
  }

  let lastError: Error = new Error("No providers available.");

  for (const provider of availableProviders) {
    try {
      log.debug(`Trying provider: ${provider.name} (model: ${model})`);
      const result = await callProvider(provider, model, messages, maxTokens);
      if (provider.name !== availableProviders[0].name) {
        log.info(`Fell back to ${provider.name} successfully.`);
      }
      return result;
    } catch (err: any) {
      lastError = err;
      log.warn(`${provider.name} failed: ${err.message} — trying next provider.`);
      continue;
    }
  }

  // All providers exhausted — surface a user-friendly message
  if ((lastError as any).isRateLimit) {
    throw new Error("Rate limit reached on all providers. Please wait a moment and try again.");
  }
  if ((lastError as any).isAuthError) {
    throw new Error("Invalid API key. Please check your EXPO_PUBLIC_QWEN_API_KEY or EXPO_PUBLIC_OPENROUTER_API_KEY.");
  }
  throw lastError;
}

// ──────────────────────────────────────────────
// FOOD SCANNER  (Gemini primary → OpenRouter → DashScope fallbacks)
// ──────────────────────────────────────────────

export async function analyzeImageWithQwen(
  base64Image: string,
  scanMode: "dish" | "ingredients",
): Promise<ScanResult> {
  const systemPrompt =
    scanMode === "dish"
      ? `You are an expert Filipino cuisine identifier and nutritionist. Analyze the food image provided and respond ONLY with valid JSON (no markdown, no code fences):
{
  "type": "dish",
  "dishName": "name of the dish",
  "isFilipino": true,
  "confidence": "high",
  "description": "detailed description of the dish including its origin and taste",
  "ingredients": ["ingredient1", "ingredient2"],
  "funFact": "interesting fact about the dish",
  "nutrition": {
    "calories": "approximate calories per serving e.g. 350 kcal",
    "protein": "e.g. 25g",
    "carbs": "e.g. 30g",
    "fat": "e.g. 12g",
    "fiber": "e.g. 3g",
    "sodium": "e.g. 800mg"
  },
  "servingSize": "e.g. 1 cup (250g)",
  "cookingTips": "a helpful tip for cooking or serving this dish"
}
If the food is not Filipino, set "isFilipino": false and still identify the dish with full nutrition info.`
      : `You are an expert ingredient identifier for Filipino cooking and a nutritionist. Analyze the image to identify all visible ingredients, then suggest Filipino dishes that can be cooked with those ingredients. Respond ONLY with valid JSON (no markdown, no code fences):
{
  "type": "ingredients",
  "ingredients": ["ingredient1", "ingredient2"],
  "suggestedRecipes": [
    {
      "name": "Recipe Name",
      "description": "Brief description of the dish",
      "mainIngredients": ["ingredient1", "ingredient2"],
      "nutrition": {
        "calories": "approximate calories per serving",
        "protein": "e.g. 20g",
        "carbs": "e.g. 35g",
        "fat": "e.g. 10g",
        "fiber": "e.g. 2g",
        "sodium": "e.g. 600mg"
      }
    }
  ]
}
Suggest 2-4 Filipino recipes that can realistically be cooked with the identified ingredients.`;

  const userText =
    scanMode === "dish"
      ? "Identify this dish and provide its nutrition facts. Respond with JSON only."
      : "Identify the ingredients and suggest Filipino recipes with nutrition info. Respond with JSON only.";

  // ── Strategy: Gemini first, then cascade through multiple vision models ──
  let content = "";

  // 1) Try Google Gemini (best free vision model)
  if (getGeminiApiKey()) {
    try {
      log.debug("Trying Gemini Flash for vision...");
      content = await callGeminiVision(systemPrompt, userText, base64Image, 1500);
      log.info("Gemini vision succeeded.");
    } catch (err: any) {
      log.warn(`Gemini failed: ${err.message} — falling back.`);
      content = "";
    }
  }

  // 2) Cascade through OpenRouter + DashScope vision models
  if (!content) {
    const messages: QwenMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
          { type: "text", text: userText },
        ],
      },
    ];

    // Vision models to try — qwen3.6-plus first (user-confirmed accurate), then VL fallbacks
    const visionModels = [
      "qwen3.6-plus-free",           // OpenRouter free — most accurate for dish ID
      "qwen3-vl-flash",              // DashScope — fast dedicated vision model
      "qwen-vl-max-latest",          // DashScope — best quality vision
      "qwen3-vl-plus",               // DashScope — strong vision backup
      "qwen-vl-max",                 // DashScope — reliable vision
      "qwen-vl-plus-latest",         // DashScope — lighter vision
      "nvidia-nemotron-vl-free",     // OpenRouter free — nvidia vision
    ];

    for (const model of visionModels) {
      try {
        log.debug(`Trying vision model: ${model}`);
        content = await callQwenAPI(model, messages, 1500, "vision");
        log.info(`Vision succeeded with: ${model}`);
        break;
      } catch (err: any) {
        log.warn(`${model} failed: ${err.message}`);
        continue;
      }
    }
  }

  if (!content) {
    return { type: "unknown", description: "No response from AI." };
  }

  const jsonStr = extractJSON(content);
  if (jsonStr) {
    try {
      return JSON.parse(jsonStr) as ScanResult;
    } catch {}
  }

  return { type: "unknown", description: content };
}

// ──────────────────────────────────────────────
// CHEF PINOY CHATBOT  (qwen-turbo-latest)
// ──────────────────────────────────────────────

export async function chatWithQwen(
  userMessage: string,
  conversationHistory: QwenMessage[] = [],
): Promise<string> {
  const systemPrompt = `You are "Chef Pinoy", a friendly and knowledgeable AI assistant specializing in Filipino cuisine. You can:
- Answer questions about Filipino dishes, ingredients, and cooking techniques
- Share the history and cultural significance of Filipino food
- Provide recipe suggestions and cooking tips
- Explain regional variations of dishes across the Philippines
- Share fun facts and trivia about Filipino cuisine

Be warm, enthusiastic, and educational. Use occasional Filipino words/phrases naturally.`;

  const messages: QwenMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const modelsToTry = ["qwen-turbo-latest", "qwen-turbo", "qwen-plus"];
  let lastError: any;

  for (const model of modelsToTry) {
    try {
      return await callQwenAPI(model, messages, 800);
    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || "").toLowerCase();
      if (message.includes("model") || message.includes("not found")) {
        log.warn(`Model ${model} unavailable, trying next fallback.`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("No chat models available.");
}

/**
 * Quick test to verify the API key is valid and the service is reachable.
 */
export async function testQwenConnectivity(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (Platform.OS === "web") {
    return {
      ok: false,
      error: "AI features are not available in the web browser.",
    };
  }

  if (getAvailableProviders("chat").length === 0 && getAvailableProviders("vision").length === 0) {
    return { ok: false, error: "No AI API keys are configured." };
  }

  try {
    const reply = await callQwenAPI(
      "qwen-turbo",
      [{ role: "user", content: "Say OK" }],
      5,
    );
    return { ok: !!reply };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
