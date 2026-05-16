"use client";

// ---------------------------------------------------------------------------
// 13.8 — Agent Stream (LLM-backed, with procedural fallback)
//
// Consumes a streaming source of ServerEvents from either:
//   - The Anthropic-backed /api/agent route (Phase 2, default), or
//   - A locally-generated procedural script (fallback when no API key)
//
// On NO_API_KEY error, automatically swaps to the procedural script so the
// demo still works without keys. UI is identical in both modes.
//
// Keyed wrapper trick: changing `resetKey` remounts InnerStream with fresh
// state. No setState-in-effect.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import type { AgentScript } from "@/lib/agent-scripts";
import {
  streamAgent,
  streamProceduralScript,
  type AgentName,
  type ServerEvent,
} from "@/lib/agent-client";

interface AgentStreamProps {
  /** Display label */
  label: string;
  /** Which agent to invoke server-side */
  agent: AgentName;
  /** Universe seed (so the server regenerates the same universe) */
  seed: number;
  /** Optional planet target */
  galaxyId?: string;
  systemId?: string;
  planetId?: string;
  /** Procedural script used if no API key (auto fallback) */
  fallbackScript: AgentScript;
  /** Triggers a re-stream when this changes */
  resetKey?: string;
  onComplete?: () => void;
}

export function AgentStream(props: AgentStreamProps) {
  return <InnerStream key={props.resetKey ?? ""} {...props} />;
}

type RenderedBlock = {
  index: number;
  kind: "status" | "thought" | "conclusion";
  text: string;
  complete: boolean;
};

function InnerStream({
  label,
  agent,
  seed,
  galaxyId,
  systemId,
  planetId,
  fallbackScript,
  onComplete,
}: AgentStreamProps) {
  const [blocks, setBlocks] = useState<RenderedBlock[]>([]);
  const [done, setDone] = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const abort = new AbortController();
    const rendered: RenderedBlock[] = [];
    let cancelled = false;

    const consume = async (source: AsyncGenerator<ServerEvent>) => {
      let currentIndex = 0;

      for await (const event of source) {
        if (cancelled) return;

        if (event.type === "error" && event.message === "NO_API_KEY") {
          // Fall back to procedural — replay using the static script
          const fallback = streamProceduralScript(fallbackScript, {
            signal: abort.signal,
          });
          await consume(fallback);
          return;
        }

        if (event.type === "error") {
          // Surface unrecoverable errors as a status row, then end
          rendered.push({
            index: currentIndex++,
            kind: "status",
            text: `ERROR: ${event.message}`,
            complete: true,
          });
          setBlocks([...rendered]);
          break;
        }

        if (event.type === "status") {
          rendered.push({
            index: currentIndex++,
            kind: "status",
            text: event.text,
            complete: true,
          });
          setBlocks([...rendered]);
          continue;
        }

        if (event.type === "block_start") {
          rendered.push({
            index: currentIndex++,
            kind: event.kind,
            text: "",
            complete: false,
          });
          setBlocks([...rendered]);
          continue;
        }

        if (event.type === "block_delta") {
          const last = rendered[rendered.length - 1];
          if (last && last.kind !== "status") {
            last.text += event.text;
            setBlocks([...rendered]);
          }
          continue;
        }

        if (event.type === "block_end") {
          const last = rendered[rendered.length - 1];
          if (last && !last.complete) {
            last.complete = true;
            setBlocks([...rendered]);
          }
          continue;
        }

        if (event.type === "done") {
          // Mark everything complete
          for (const b of rendered) b.complete = true;
          setBlocks([...rendered]);
          setDone(true);
          completeRef.current?.();
          return;
        }
      }
    };

    consume(
      streamAgent(
        { agent, seed, galaxyId, systemId, planetId },
        abort.signal,
      ),
    );

    return () => {
      cancelled = true;
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div
          className={`h-1.5 w-1.5 rounded-full ${
            done ? "bg-white/60" : "bg-cyan-300 animate-pulse"
          }`}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/55">
          {label} · {done ? "complete" : "analyzing"}
        </span>
      </div>

      <div className="space-y-2 pl-3.5 border-l border-white/[0.07]">
        {blocks.map((b) => (
          <BlockLine key={b.index} block={b} />
        ))}
      </div>
    </div>
  );
}

function BlockLine({ block }: { block: RenderedBlock }) {
  if (block.kind === "status") {
    return (
      <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/40">
        ▸ {block.text}
      </p>
    );
  }
  if (block.kind === "conclusion") {
    return (
      <p className="font-mono text-[11.5px] leading-relaxed text-white/90 whitespace-pre-wrap">
        {block.text}
        {!block.complete && <CaretInline />}
      </p>
    );
  }
  return (
    <p className="font-mono text-[10.5px] leading-relaxed text-white/55 italic whitespace-pre-wrap">
      {block.text}
      {!block.complete && <CaretInline />}
    </p>
  );
}

function CaretInline() {
  return (
    <span className="ml-0.5 inline-block h-[0.85em] w-[0.4em] -mb-[0.05em] bg-white/70 animate-pulse align-middle" />
  );
}
