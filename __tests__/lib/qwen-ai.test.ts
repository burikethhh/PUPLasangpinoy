/**
 * Tests for lib/qwen-ai.ts
 *
 * Strategy:
 *  - extractJSON is tested as a pure function (no mocks needed)
 *  - callQwenAPI is private; tested indirectly through analyzeImageWithQwen /
 *    chatWithQwen / testQwenConnectivity
 *  - Platform.OS is controlled per-describe block via jest.resetModules() +
 *    re-importing the module so the module-level constant is re-evaluated
 *  - fetch is mocked globally
 */

// ── Mock react-native before anything else ─────────────────
jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: any) => obj.ios ?? obj.default },
}));

// ── Mock logger (no-op) ────────────────────────────────────
jest.mock("../../lib/logger", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import { analyzeImageWithQwen, chatWithQwen, extractJSON, testQwenConnectivity } from "../../lib/qwen-ai";

// ── Global fetch mock ──────────────────────────────────────
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Helper: make fetch return a JSON body with given status
function mockFetchResponse(status: number, body: object | string) {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(bodyStr),
    json: jest.fn().mockResolvedValue(typeof body === "string" ? {} : body),
  });
}

// Helper: make fetch reject (network error / AbortError)
function mockFetchAbort() {
  const err = new Error("The user aborted a request.");
  err.name = "AbortError";
  mockFetch.mockRejectedValueOnce(err);
}

beforeEach(() => {
  jest.clearAllMocks();
  // Restore real timers between tests so setTimeout in callQwenAPI works
  jest.useRealTimers();
});

// ────────────────────────────────────────────────────────────
// extractJSON — pure function, no mocks needed
// ────────────────────────────────────────────────────────────

describe("extractJSON", () => {
  it("strips ```json ... ``` fences", () => {
    const input = '```json\n{"type":"dish"}\n```';
    expect(extractJSON(input)).toBe('{"type":"dish"}');
  });

  it("strips plain ``` ... ``` fences", () => {
    const input = "```\n{\"a\":1}\n```";
    expect(extractJSON(input)).toBe('{"a":1}');
  });

  it("extracts bare {...} when no fence", () => {
    const input = 'Sure! Here is the result: {"type":"dish","dishName":"Adobo"}';
    const result = extractJSON(input);
    expect(result).toContain('"type":"dish"');
  });

  it("returns null when no JSON found", () => {
    expect(extractJSON("No JSON at all here, sorry!")).toBeNull();
  });

  it("returns as-is for a bare JSON string", () => {
    const json = '{"type":"ingredients","ingredients":["Pork"]}';
    expect(extractJSON(json)).toBe(json);
  });
});

// ────────────────────────────────────────────────────────────
// testQwenConnectivity
// ────────────────────────────────────────────────────────────

describe("testQwenConnectivity", () => {
  it("returns {ok: false} immediately on web platform", async () => {
    const { Platform } = require("react-native");
    const savedOS = Platform.OS;
    Platform.OS = "web";
    try {
      const result = await testQwenConnectivity();
      expect(result).toEqual({
        ok: false,
        error: expect.stringContaining("web"),
      });
    } finally {
      Platform.OS = savedOS;
    }
  });

  it("returns {ok: true} when API responds with content", async () => {
    process.env.EXPO_PUBLIC_QWEN_API_KEY = "sk-testkey";
    mockFetchResponse(200, {
      choices: [{ message: { content: "OK" } }],
    });

    const result = await testQwenConnectivity();
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns {ok: false, error: ...} on HTTP 401", async () => {
    process.env.EXPO_PUBLIC_QWEN_API_KEY = "sk-testkey";
    delete process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
    mockFetchResponse(401, { error: { message: "Unauthorized" } });

    const result = await testQwenConnectivity();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Invalid API key/i);
  });

  it("returns {ok: false, error: ...} on HTTP 429", async () => {
    process.env.EXPO_PUBLIC_QWEN_API_KEY = "sk-testkey";
    delete process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
    mockFetchResponse(429, { error: { message: "Too Many Requests" } });

    const result = await testQwenConnectivity();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Rate limit/i);
  });

  it("returns {ok: false, error: ...} on network timeout (AbortError)", async () => {
    process.env.EXPO_PUBLIC_QWEN_API_KEY = "sk-testkey";
    mockFetchAbort();

    const result = await testQwenConnectivity();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timed out/i);
  });
});

// ────────────────────────────────────────────────────────────
// analyzeImageWithQwen
// ────────────────────────────────────────────────────────────

describe("analyzeImageWithQwen", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_QWEN_API_KEY = "sk-testkey";
  });

  it("returns a parsed ScanResult for dish mode", async () => {
    const payload = {
      type: "dish",
      dishName: "Adobo",
      isFilipino: true,
      confidence: "high",
      description: "A popular Filipino stew",
      ingredients: ["Pork", "Vinegar", "Soy Sauce"],
      funFact: "Considered the unofficial national dish of the Philippines",
    };
    mockFetchResponse(200, {
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });

    const result = await analyzeImageWithQwen("base64data", "dish");
    expect(result.type).toBe("dish");
    expect(result.dishName).toBe("Adobo");
    expect(result.isFilipino).toBe(true);
  });

  it("returns a parsed ScanResult for ingredients mode", async () => {
    const payload = {
      type: "ingredients",
      ingredients: ["Pork", "Radish"],
      suggestedRecipes: [
        { name: "Sinigang", description: "A sour soup", mainIngredients: ["Pork", "Radish"] }
      ],
    };
    mockFetchResponse(200, {
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });

    const result = await analyzeImageWithQwen("base64data", "ingredients");
    expect(result.type).toBe("ingredients");
    expect(result.ingredients).toContain("Pork");
    expect(result.suggestedRecipes?.[0]?.name).toBe("Sinigang");
  });

  it("handles model fallback when primary model is not found", async () => {
    // First call returns a model-not-found error
    // Vision uses OpenRouter first (if available), then DashScope
    // With only QWEN key set in test, only DashScope is available
    mockFetchResponse(400, {
      error: { message: "model not found: qwen-vl-max-latest" },
    });
    mockFetchResponse(200, {
      choices: [{ message: { content: '{"type":"dish","dishName":"Sinigang"}' } }],
    });

    const result = await analyzeImageWithQwen("base64data", "dish");
    expect(result.dishName).toBe("Sinigang");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns {type: unknown} when response has no content", async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: "" } }],
    });

    const result = await analyzeImageWithQwen("base64data", "dish");
    expect(result.type).toBe("unknown");
  });

  it("returns {type: unknown, description: raw} when JSON is unparseable", async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: "Sorry, I cannot identify this food." } }],
    });

    const result = await analyzeImageWithQwen("base64data", "dish");
    expect(result.type).toBe("unknown");
    expect(result.description).toContain("Sorry");
  });

  it("parses JSON wrapped in markdown fences", async () => {
    const json = '{"type":"dish","dishName":"Lechon"}';
    mockFetchResponse(200, {
      choices: [{ message: { content: `\`\`\`json\n${json}\n\`\`\`` } }],
    });

    const result = await analyzeImageWithQwen("base64data", "dish");
    expect(result.dishName).toBe("Lechon");
  });
});

// ────────────────────────────────────────────────────────────
// chatWithQwen
// ────────────────────────────────────────────────────────────

describe("chatWithQwen", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_QWEN_API_KEY = "sk-testkey";
  });

  it("returns the assistant reply string", async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: "Adobo is a classic Filipino dish!" } }],
    });

    const reply = await chatWithQwen("Tell me about Adobo");
    expect(reply).toBe("Adobo is a classic Filipino dish!");
  });

  it("includes conversation history in the request body", async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: "Yes, Sinigang is sour!" } }],
    });

    const history = [
      { role: "user" as const, content: "Is Sinigang sour?" },
      { role: "assistant" as const, content: "It depends on the souring agent." },
    ];
    await chatWithQwen("Tell me more", history);

    const requestBody = JSON.parse(
      mockFetch.mock.calls[0][1].body as string,
    );
    // Should contain system + 2 history messages + new user message = 4 messages
    expect(requestBody.messages).toHaveLength(4);
    expect(requestBody.messages[3].content).toBe("Tell me more");
  });

  it("throws on HTTP 401 (invalid API key)", async () => {
    mockFetchResponse(401, { error: { message: "Unauthorized" } });
    await expect(chatWithQwen("Hello")).rejects.toThrow(/Invalid API key/i);
  });

  it("throws on HTTP 429 (rate limit)", async () => {
    mockFetchResponse(429, {});
    await expect(chatWithQwen("Hello")).rejects.toThrow(/Rate limit/i);
  });

  it("uses only DashScope for chat (no OpenRouter fallback)", async () => {
    process.env.EXPO_PUBLIC_QWEN_API_KEY = "sk-dashscope-key";
    process.env.EXPO_PUBLIC_OPENROUTER_API_KEY = "sk-openrouter-key";

    // DashScope succeeds
    mockFetchResponse(200, {
      choices: [{ message: { content: "Kamusta! Adobo is great." } }],
    });

    const reply = await chatWithQwen("Tell me about Adobo");
    expect(reply).toBe("Kamusta! Adobo is great.");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Only DashScope URL should be called
    expect(mockFetch.mock.calls[0][0]).toContain("dashscope-intl");

    delete process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  });

  it("throws a timeout message on AbortError", async () => {
    // Chat uses DashScope only, so only one abort mock needed
    mockFetchAbort();
    await expect(chatWithQwen("Hello")).rejects.toThrow(/timed out/i);
  });
});
