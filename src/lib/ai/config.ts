import "server-only";
import { getSetting } from "@/lib/db/settings";
import type { AiProvider } from "@/lib/types";

const DEFAULT_MODELS: Record<AiProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};

const ENV_KEY: Record<AiProvider, string> = {
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const ENV_MODEL: Record<AiProvider, string> = {
  groq: "GROQ_MODEL",
  gemini: "GEMINI_MODEL",
  openrouter: "OPENROUTER_MODEL",
};

export const PROVIDERS: AiProvider[] = ["groq", "gemini", "openrouter"];

export interface ResolvedProvider {
  provider: AiProvider;
  model: string;
  apiKey: string | null;
}

/** Active provider: runtime setting → AI_PROVIDER env → groq. */
export async function activeProvider(): Promise<AiProvider> {
  const fromDb = await getSetting("ai_provider");
  if (fromDb && PROVIDERS.includes(fromDb as AiProvider)) return fromDb as AiProvider;
  const fromEnv = process.env.AI_PROVIDER;
  if (fromEnv && PROVIDERS.includes(fromEnv as AiProvider)) return fromEnv as AiProvider;
  return "groq";
}

export async function modelFor(provider: AiProvider): Promise<string> {
  return (
    (await getSetting(`${provider}_model`)) ||
    process.env[ENV_MODEL[provider]] ||
    DEFAULT_MODELS[provider]
  );
}

export function apiKeyFor(provider: AiProvider): string | null {
  return process.env[ENV_KEY[provider]]?.trim() || null;
}

export async function resolveProvider(): Promise<ResolvedProvider> {
  const provider = await activeProvider();
  return { provider, model: await modelFor(provider), apiKey: apiKeyFor(provider) };
}

export interface ProviderStatus {
  provider: AiProvider;
  active: boolean;
  connected: boolean;
  model: string;
}

/** For the Settings page: which providers have keys, which is active. */
export async function providerStatuses(): Promise<ProviderStatus[]> {
  const active = await activeProvider();
  return Promise.all(
    PROVIDERS.map(async (p) => ({
      provider: p,
      active: p === active,
      connected: !!apiKeyFor(p),
      model: await modelFor(p),
    }))
  );
}
