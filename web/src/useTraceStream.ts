import { useEffect, useRef, useState } from "react";
import type { TraceEvent } from "./types";

export function useTraceStream(disputeId: string | null) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!disputeId) {
      setEvents([]);
      lastIdRef.current = null;
      return;
    }
    if (lastIdRef.current !== disputeId) {
      setEvents([]);
      lastIdRef.current = disputeId;
    }
    const es = new EventSource(`/events/${disputeId}`);
    es.addEventListener("trace", (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as TraceEvent;
        setEvents((prev) => [...prev, ev]);
      } catch {}
    });
    es.addEventListener("error", () => {
      // SSE auto-reconnects; nothing to do
    });
    return () => es.close();
  }, [disputeId]);

  return events;
}
