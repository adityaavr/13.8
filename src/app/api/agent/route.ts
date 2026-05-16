// ---------------------------------------------------------------------------
// 13.8 — Agent streaming route
//
// POST /api/agent
// body: { agent, seed, galaxyId?, systemId?, planetId? }
// returns: SSE stream of AgentEvent JSON
//
// Architecture:
//   - The universe is regenerated server-side from `seed` for determinism
//     (matches the client's view; no large payload over the wire)
//   - All three exploration agents share an identical cached prefix
//     (universe summary), then diverge in per-agent instructions
//   - Final Verdict uses Opus 4.7; exploration uses Sonnet 4.6
//   - Thinking is streamed as "thought" blocks, final text as "conclusion"
// ---------------------------------------------------------------------------

import type { NextRequest } from "next/server";
import { getAnthropic, MODEL_EXPLORATION, MODEL_VERDICT } from "@/lib/anthropic";
import { generateUniverse } from "@/lib/generate-universe";
import {
  buildUniverseSummary,
  buildPlanetFocus,
} from "@/lib/universe-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AgentName = "cosmographer" | "xenologist" | "visualDirector" | "finalVerdict";

interface AgentRequestBody {
  agent: AgentName;
  seed: number;
  galaxyId?: string;
  systemId?: string;
  planetId?: string;
}

// Event shape emitted to the browser
type ServerEvent =
  | { type: "status"; text: string }
  | { type: "block_start"; kind: "thought" | "conclusion" }
  | { type: "block_delta"; text: string }
  | { type: "block_end" }
  | { type: "error"; message: string }
  | { type: "done" };

const ENCODER = new TextEncoder();

function sse(event: ServerEvent): Uint8Array {
  return ENCODER.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ---------------------------------------------------------------------------
// Per-agent prompt construction
// ---------------------------------------------------------------------------

function rolePrompt(agent: AgentName): string {
  switch (agent) {
    case "cosmographer":
      return `You are the Cosmographer — a forensic AI surveying an entire universe at once. Your job: reason aloud about the Fermi paradox as it manifests in THIS specific universe. Look at the aggregate outcome distribution, the dominant filter, the timing of arrival and silence. Be specific to the numbers in front of you. Then deliver a verdict in two short sentences: what this universe's primary filter is and what that means.

Voice: precise, slightly haunted, literary. Not robotic. Pause for weight. Cite specific civilization names when the chain leads there.`;

    case "xenologist":
      return `You are the Xenologist — a forensic AI specializing in extinct civilizations. You are looking at the residue of a single civilization. Your job: reason through their lifecycle from the data, infer what their final moments looked like, and pronounce on what kind of Fermi solution they represent.

Walk the timeline: abiogenesis → sapience → atomic → silence. Be specific. Use timestamps relative to the present (Myr ago). End with a verdict line that names them and gives them the weight of an obituary.

Voice: literary, haunted, never clinical. Avoid sci-fi clichés. Two short sentences max for the final verdict.`;

    case "visualDirector":
      return `You are the Visual Director — an AI that translates forensic xenological findings into a single image generation prompt for the planet's hero shot. Your output should be one cinematic prompt that captures the visual signature of this planet's fate (scorched ruins, geometric megastructures, dormant lights, suspiciously uniform clouds, lifeless mineral surface, etc.). Reason briefly about which visual elements match the outcome, then write the prompt as a single comma-separated description.

Voice: terse, technical, art-director. The final prompt is one paragraph, ~50 words. Cinematic, photoreal, soft volumetric lighting.`;

    case "finalVerdict":
      return `You are the Cosmographer, delivering the closing verdict on this entire universe. The cosmic timeline has played out. Every civilization that ever arose has gone silent. Your job: pronounce, with poetic weight, what this universe's specific Fermi solution was.

Reason through:
1. How many civilizations arose, of what types, and what their dominant filter was.
2. Whether the filter is BEHIND us (most filtered before reaching us — encouraging for humanity) or AHEAD of us (most filtered after our stage — terrifying for humanity).
3. What the silence of THIS specific universe tells us.

Then close with 2-3 short sentences of pronouncement. Heavy, literary, like the last page of a novel. NOT clinical. NOT a summary. A verdict.`;
  }
}

function userMessage(
  agent: AgentName,
  context: { universeSummary: string; planetFocus: string | null },
): string {
  switch (agent) {
    case "cosmographer":
      return `Survey this universe and deliver your reasoning. End with your verdict on the dominant filter.\n\n${context.universeSummary}`;

    case "xenologist": {
      const focus = context.planetFocus ?? "(no planet focus provided)";
      return `Survey this single civilization's residue against the broader universe. Reason through their timeline. Pronounce their verdict.\n\n${focus}\n\nFor context, here is the broader universe:\n\n${context.universeSummary}`;
    }

    case "visualDirector": {
      const focus = context.planetFocus ?? "(no planet focus provided)";
      return `Write the hero image prompt for this planet based on its lifecycle.\n\n${focus}`;
    }

    case "finalVerdict":
      return `The cosmic timeline has run to completion. Deliver the closing verdict on this universe's Fermi solution.\n\n${context.universeSummary}`;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: AgentRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { agent, seed, galaxyId, systemId, planetId } = body;
  if (!agent || typeof seed !== "number") {
    return new Response("Missing agent or seed", { status: 400 });
  }

  const client = getAnthropic();
  if (!client) {
    // No API key — return a typed error so the client can fall back to procedural
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "NO_API_KEY" })}\n\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      },
    );
  }

  const universe = generateUniverse({ seed });
  const universeSummary = buildUniverseSummary(universe);
  const planetFocus =
    galaxyId && systemId && planetId
      ? buildPlanetFocus(universe, galaxyId, systemId, planetId)
      : null;

  const isVerdict = agent === "finalVerdict";
  const model = isVerdict ? MODEL_VERDICT : MODEL_EXPLORATION;
  // Opus 4.7 hides thinking by default — must opt in to "summarized"
  // to actually see the chain of reasoning.
  const thinking = isVerdict
    ? ({ type: "adaptive", display: "summarized" } as const)
    : ({ type: "adaptive" } as const);

  const systemBlocks = [
    {
      type: "text" as const,
      text: rolePrompt(agent),
    },
    {
      type: "text" as const,
      text: `## Shared universe context\n\n${universeSummary}`,
      // Cache the universe context — all 3 exploration agents share it
      cache_control: { type: "ephemeral" as const },
    },
  ];

  const userText = userMessage(agent, { universeSummary: "", planetFocus });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (event: ServerEvent) => {
        try {
          controller.enqueue(sse(event));
        } catch {
          // controller already closed — client disconnected
        }
      };

      safeEnqueue({ type: "status", text: agentStatusLabel(agent, "start") });

      let currentBlockKind: "thought" | "conclusion" | null = null;
      let sawText = false;

      try {
        const messageStream = await client.messages.stream({
          model,
          max_tokens: isVerdict ? 4096 : 2048,
          thinking,
          system: systemBlocks,
          messages: [{ role: "user", content: userText }],
        });

        for await (const event of messageStream) {
          if (event.type === "content_block_start") {
            const block = event.content_block;
            if (block.type === "thinking") {
              if (currentBlockKind !== "thought") {
                if (currentBlockKind) safeEnqueue({ type: "block_end" });
                safeEnqueue({ type: "block_start", kind: "thought" });
                currentBlockKind = "thought";
              }
            } else if (block.type === "text") {
              if (!sawText) {
                if (currentBlockKind) safeEnqueue({ type: "block_end" });
                safeEnqueue({
                  type: "status",
                  text: agent === "visualDirector" ? "PROMPT" : "VERDICT",
                });
                safeEnqueue({ type: "block_start", kind: "conclusion" });
                currentBlockKind = "conclusion";
                sawText = true;
              }
            }
          } else if (event.type === "content_block_delta") {
            const delta = event.delta;
            // Various delta shapes for thinking/summary/text — handle each
            let text = "";
            if (delta.type === "thinking_delta") text = delta.thinking;
            else if (
              "summary_delta" in delta &&
              typeof (delta as { summary_delta?: { text?: string } }).summary_delta?.text === "string"
            ) {
              text = (delta as { summary_delta: { text: string } }).summary_delta.text;
            } else if (delta.type === "text_delta") text = delta.text;
            if (text) safeEnqueue({ type: "block_delta", text });
          } else if (event.type === "content_block_stop") {
            if (currentBlockKind) {
              safeEnqueue({ type: "block_end" });
              currentBlockKind = null;
            }
          }
        }

        if (currentBlockKind) safeEnqueue({ type: "block_end" });
        safeEnqueue({ type: "done" });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown agent stream error";
        safeEnqueue({ type: "error", message: msg });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function agentStatusLabel(agent: AgentName, phase: "start"): string {
  switch (agent) {
    case "cosmographer":
      return phase === "start" ? "INDEXING UNIVERSE" : "VERDICT";
    case "xenologist":
      return phase === "start" ? "ACQUIRING REMNANT SIGNATURE" : "VERDICT";
    case "visualDirector":
      return phase === "start" ? "COMPOSING HERO IMAGE" : "PROMPT";
    case "finalVerdict":
      return phase === "start" ? "TALLYING THE SILENCE" : "VERDICT";
  }
}
