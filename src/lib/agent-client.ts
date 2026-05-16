// ---------------------------------------------------------------------------
// 13.8 — Client-side agent streaming
//
// Connects to /api/agent and yields ServerEvents. Used by the AgentStream
// component. On NO_API_KEY error, falls back to the procedural script
// generator so the demo still works.
// ---------------------------------------------------------------------------

import type { AgentScript } from "./agent-scripts";

export type AgentName =
  | "cosmographer"
  | "xenologist"
  | "visualDirector"
  | "finalVerdict";

export interface AgentRequest {
  agent: AgentName;
  seed: number;
  galaxyId?: string;
  systemId?: string;
  planetId?: string;
}

export type ServerEvent =
  | { type: "status"; text: string }
  | { type: "block_start"; kind: "thought" | "conclusion" }
  | { type: "block_delta"; text: string }
  | { type: "block_end" }
  | { type: "error"; message: string }
  | { type: "done" };

// ---------------------------------------------------------------------------
// SSE parser — reads from the fetch ReadableStream and yields events
// ---------------------------------------------------------------------------

export async function* streamAgent(
  req: AgentRequest,
  signal?: AbortSignal,
): AsyncGenerator<ServerEvent> {
  let res: Response;
  try {
    res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (e) {
    yield {
      type: "error",
      message: e instanceof Error ? e.message : "network failure",
    };
    return;
  }

  if (!res.ok || !res.body) {
    yield {
      type: "error",
      message: `HTTP ${res.status}`,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const evt of events) {
        const line = evt
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice(6);
        try {
          const parsed = JSON.parse(payload) as ServerEvent;
          yield parsed;
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Procedural fallback — turns a static script into the same event stream
// shape, with deliberate pacing so the UI doesn't dump the whole script
// instantly. Used when no API key is set.
// ---------------------------------------------------------------------------

export async function* streamProceduralScript(
  script: AgentScript,
  opts: { charDelay?: number; blockPause?: number; signal?: AbortSignal } = {},
): AsyncGenerator<ServerEvent> {
  const charDelay = opts.charDelay ?? 12;
  const blockPause = opts.blockPause ?? 220;

  const isAborted = () => opts.signal?.aborted === true;
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  for (const block of script) {
    if (isAborted()) return;

    if (block.kind === "status") {
      yield { type: "status", text: block.text };
      await sleep(blockPause * 0.6);
      continue;
    }

    yield {
      type: "block_start",
      kind: block.kind === "conclusion" ? "conclusion" : "thought",
    };

    const text = block.text;
    const stride = 3; // 3-char chunks so it feels token-streamy
    for (let i = 0; i < text.length; i += stride) {
      if (isAborted()) return;
      yield { type: "block_delta", text: text.slice(i, i + stride) };
      await sleep(charDelay * stride);
    }

    yield { type: "block_end" };
    await sleep(blockPause);
  }

  yield { type: "done" };
}
