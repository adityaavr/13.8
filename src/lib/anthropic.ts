// ---------------------------------------------------------------------------
// 13.8 — Anthropic client singleton
//
// Server-only. Never import from a "use client" file.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic();
  return _client;
}

// Model assignments per agent. Sonnet 4.6 for fast exploration streams;
// Opus 4.7 for the cinematic Final Verdict (one call, max quality).
export const MODEL_EXPLORATION = "claude-sonnet-4-6";
export const MODEL_VERDICT = "claude-opus-4-7";
