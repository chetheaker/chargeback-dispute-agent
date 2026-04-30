import { useEffect, useRef } from "react";
import type { TraceEvent } from "../types";

interface Props {
  events: TraceEvent[];
}

const ICONS: Record<string, string> = {
  "pipeline.start": "▶",
  "pipeline.done": "✓",
  "pipeline.error": "✕",
  "agent.start": "🤖",
  "agent.turn": "↻",
  "agent.tool_use": "⚙",
  "agent.evidence": "📄",
  "agent.finalized": "✦",
  "agent.no_tool_call": "·",
  "submit.prepare": "↑",
  "submit.file_uploaded": "📎",
  "submit.ok": "✓",
  "submit.error": "✕",
  "webhook.duplicate": "↻",
};

export function Timeline({ events }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="timeline empty">
        <span className="muted">Waiting for events…</span>
      </div>
    );
  }

  return (
    <div className="timeline" ref={ref}>
      {events.map((e, i) => (
        <div key={i} className={`event event-${e.type.replace(/\./g, "-")}`}>
          <span className="event-icon">{ICONS[e.type] ?? "·"}</span>
          <span className="event-time">{fmtTime(e.ts)}</span>
          <span className="event-type">{e.type}</span>
          <span className="event-data">{summarize(e.type, e.data)}</span>
        </div>
      ))}
    </div>
  );
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function summarize(type: string, data: any): string {
  if (!data) return "";
  switch (type) {
    case "agent.tool_use":
      return data.name ?? "";
    case "agent.evidence":
      return `${data.kind} · ${data.summary ?? data.id}`;
    case "agent.turn":
      return `turn ${data.turn} · ${(data.blocks ?? []).join(", ")}`;
    case "agent.finalized":
      return `${data.reasonCode} · ${data.citedCount} cited`;
    case "submit.file_uploaded":
      return `${data.field} → ${data.fileId}`;
    case "submit.ok":
      return `status: ${data.status}${data.submit ? " (submitted)" : " (staged)"}`;
    case "submit.prepare":
      return `${(data.fileFields ?? []).length} files, ${(data.textFields ?? []).length} text fields`;
    case "pipeline.start":
      return `reason: ${data.reason}`;
    case "pipeline.done":
      return `${data.reasonCode}${data.submitted ? " · submitted" : " · staged"}`;
    default:
      return JSON.stringify(data).slice(0, 80);
  }
}
