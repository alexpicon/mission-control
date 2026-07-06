// AI provider layer.
//
// This is the ONLY file that talks to the model API. The rest of the app calls
// `complete()`. To move to a real backend later, swap the body of `complete()`
// to hit your server instead of Anthropic directly — nothing else changes.
//
// The request goes through Tauri's HTTP plugin (Rust side), so the API key
// never touches a remote web page and there are no browser CORS issues.

import { fetch } from "@tauri-apps/plugin-http";
import { getSetting, setSetting } from "../db";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Small, fast, cheap model — right default for short local answers.
// Change here if you want a stronger model.
export const MODEL = "claude-haiku-4-5-20251001";

const API_KEY_SETTING = "anthropic_api_key";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("No Anthropic API key set.");
    this.name = "MissingApiKeyError";
  }
}

// Resolve the key from local settings first, then an optional .env fallback
// (VITE_ANTHROPIC_API_KEY) for dev convenience. Never hardcoded.
export async function getApiKey(): Promise<string | null> {
  const stored = await getSetting(API_KEY_SETTING);
  if (stored && stored.trim()) return stored.trim();
  const env = (import.meta.env as Record<string, string | undefined>)
    .VITE_ANTHROPIC_API_KEY;
  return env && env.trim() ? env.trim() : null;
}

export async function setApiKey(key: string): Promise<void> {
  await setSetting(API_KEY_SETTING, key.trim());
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) !== null;
}

export async function complete(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<string> {
  const key = await getApiKey();
  if (!key) throw new MissingApiKeyError();

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 700,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();

  return text || "(empty response)";
}

// Structured-JSON completion. Used only for tasks that must return machine-
// readable data (MVP extraction, evidence matching) — never for free text.
// Throws rather than guessing if the model's output isn't valid JSON, so
// callers can fall back to "Not enough data" instead of fabricating a result.
export async function completeJson<T>(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<T> {
  const text = await complete(opts);
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("Model did not return valid JSON.");
  }
}
