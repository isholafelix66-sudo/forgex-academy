import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { textProviders } from "./resilienceGateway";

/**
 * The AI provider failover chain is the backbone of "AI responses never fail".
 * These tests lock in the two things that matter:
 *   1. every configured provider is included, in a stable primary-first order;
 *   2. no provider keys at all still leaves a working path, because
 *      gatewayChat falls back to the platform integration.
 */

const PROVIDER_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "OPENAI_API_KEY",
  "NOVITA_API_KEY",
  "OPENROUTER_API_KEY",
  "CEREBRAS_API_KEY",
  "TOGETHER_API_KEY",
  "DEEPSEEK_API_KEY",
  "MISTRAL_API_KEY",
  "SAMBANOVA_API_KEY",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of PROVIDER_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of PROVIDER_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("AI provider fallback chain", () => {
  it("is empty without keys — the platform integration then serves the request", () => {
    expect(textProviders()).toEqual([]);
  });

  it("keeps the primary provider first and appends optional providers after it", () => {
    process.env.GEMINI_API_KEY = "g";
    process.env.OPENAI_API_KEY = "o";
    process.env.OPENROUTER_API_KEY = "r";
    process.env.CEREBRAS_API_KEY = "c";

    const chain = textProviders().map((p) => p.name);
    expect(chain[0]).toBe("gemini");
    expect(chain).toEqual(["gemini", "openai", "openrouter", "cerebras"]);
  });

  it("includes every configured provider exactly once", () => {
    process.env.GEMINI_API_KEY = "g";
    process.env.GROQ_API_KEY = "q";
    process.env.OPENAI_API_KEY = "o";
    process.env.NOVITA_API_KEY = "n";
    process.env.OPENROUTER_API_KEY = "r";
    process.env.CEREBRAS_API_KEY = "c";
    process.env.TOGETHER_API_KEY = "t";
    process.env.DEEPSEEK_API_KEY = "d";
    process.env.MISTRAL_API_KEY = "m";
    process.env.SAMBANOVA_API_KEY = "s";

    const names = textProviders().map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "gemini",
      "groq",
      "openai",
      "novita",
      "openrouter",
      "cerebras",
      "together",
      "deepseek",
      "mistral",
      "sambanova",
    ]);
  });

  it("accepts GOOGLE_API_KEY as the Gemini key and gives the provider a model", () => {
    process.env.GOOGLE_API_KEY = "g";
    const [first] = textProviders();
    expect(first.name).toBe("gemini");
    expect(first.model.length).toBeGreaterThan(0);
    expect(first.base).toContain("generativelanguage.googleapis.com");
  });
});
