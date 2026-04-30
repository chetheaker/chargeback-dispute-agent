import { useEffect, useMemo, useState } from "react";
import {
  getDispute,
  listDisputes,
  rerunDispute,
  submitDispute,
  triggerDemo,
} from "./api";
import { useTraceStream } from "./useTraceStream";
import type { DisputeRecord, DisputeSummary, TraceEvent } from "./types";
import { Sidebar } from "./components/Sidebar";
import { DisputeHeader } from "./components/DisputeHeader";
import { Timeline } from "./components/Timeline";
import { EvidenceCards } from "./components/EvidenceCards";
import { Verdict } from "./components/Verdict";
import { StripePayload } from "./components/StripePayload";

export function App() {
  const [list, setList] = useState<DisputeSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [record, setRecord] = useState<DisputeRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const traceEvents = useTraceStream(selected);

  async function refreshList(autoSelect = false) {
    const items = await listDisputes();
    setList(items);
    if (autoSelect && items.length && !selected) {
      setSelected(items[0]!.disputeId);
    }
  }

  useEffect(() => {
    refreshList(true);
    const t = setInterval(refreshList, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected) {
      setRecord(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const r = await getDispute(selected);
        if (!cancelled) setRecord(r);
      } catch {}
    };
    load();
    const t = setInterval(load, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [selected]);

  const onTrigger = async () => {
    setBusy(true);
    try {
      await triggerDemo();
      setTimeout(refreshList, 1500);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await submitDispute(selected);
      const r = await getDispute(selected);
      setRecord(r);
      refreshList();
    } finally {
      setBusy(false);
    }
  };

  const onRerun = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await rerunDispute(selected);
    } finally {
      setBusy(false);
    }
  };

  const evidenceFromTrace = useMemo(() => {
    return extractEvidenceFromTrace(traceEvents);
  }, [traceEvents]);

  const evidenceRecords =
    record?.result?.evidenceRecords?.length
      ? record.result.evidenceRecords
      : evidenceFromTrace;

  return (
    <div className="app">
      <Sidebar
        items={list}
        selected={selected}
        onSelect={setSelected}
        onTrigger={onTrigger}
        busy={busy}
      />
      <main className="main">
        {!selected && (
          <div className="empty">
            <h1>Chargeback Dispute Agent</h1>
            <p>
              Trigger a test dispute via the sidebar, or fire one from the
              terminal:
            </p>
            <pre>stripe trigger charge.dispute.created</pre>
          </div>
        )}
        {selected && (
          <>
            <DisputeHeader
              record={record}
              onSubmit={onSubmit}
              onRerun={onRerun}
              busy={busy}
            />
            <div className="grid">
              <section className="col">
                <h2>Timeline</h2>
                <Timeline events={traceEvents} />
              </section>
              <section className="col">
                <Verdict result={record?.result ?? null} />
                <EvidenceCards records={evidenceRecords} />
                <StripePayload result={record?.result ?? null} />
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function extractEvidenceFromTrace(events: TraceEvent[]) {
  const byId = new Map<
    string,
    { id: string; kind: string; summary: string; data: unknown }
  >();
  for (const e of events) {
    if (e.type !== "agent.evidence") continue;
    const d = e.data;
    if (d?.id) byId.set(d.id, { id: d.id, kind: d.kind, summary: d.summary, data: undefined });
  }
  return Array.from(byId.values());
}
