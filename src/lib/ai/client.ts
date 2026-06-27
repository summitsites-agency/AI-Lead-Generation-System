import "server-only";
import type { AiProvider } from "@/lib/types";
import { resolveProvider, type ResolvedProvider } from "./config";

export interface ChatOptions {
  system?: string;
  /** Force JSON-object output where the provider supports it. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export class NoApiKeyError extends Error {
  constructor(provider: AiProvider) {
    super(`No API key configured for provider "${provider}"`);
    this.name = "NoApiKeyError";
  }
}

/**
 * Provider-agnostic single-turn chat. Returns the assistant text.
 * Throws NoApiKeyError when the active provider has no key (callers fall back).
 */
export async function chat(prompt: string, opts: ChatOptions = {}): Promise<string> {
  const cfg = await resolveProvider();
  if (!cfg.apiKey) throw new NoApiKeyError(cfg.provider);

  if (cfg.provider === "gemini") return geminiChat(cfg, prompt, opts);
  // Groq and OpenRouter are both OpenAI chat-completions compatible.
  return openAiCompatChat(cfg, prompt, opts);
}

function endpointFor(provider: AiProvider): string {
  switch (provider) {
    case "groq":
      return "https://api.groq.com/openai/v1/chat/completions";
    case "openrouter":
      return "https://openrouter.ai/api/v1/chat/completions";
    default:
      return "";
  }
}

async function openAiCompatChat(
  cfg: ResolvedProvider,
  prompt: string,
  opts: ChatOptions
): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://summitsites.local";
    headers["X-Title"] = "Summit Sites Lead Intelligence";
  }

  const res = await fetch(endpointFor(cfg.provider), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${cfg.provider} API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function geminiChat(
  cfg: ResolvedProvider,
  prompt: string,
  opts: ChatOptions
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cfg.model
  )}:generateContent?key=${cfg.apiKey}`;

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.4,
    maxOutputTokens: opts.maxTokens ?? 1200,
  };
  if (opts.json) generationConfig.responseMimeType = "application/json";

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`gemini API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
}
