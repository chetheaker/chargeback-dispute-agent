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
import { Dashboard } from "./components/Dashboard";

export function App() {
  const [list, setList] = useState<DisputeSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [record, setRecord] = useState<DisputeRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const traceEvents = useTraceStream(selected);

  async function refreshList() {
    const items = await listDisputes();
    setList(items);
  }

  useEffect(() => {
    refreshList();
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
        onHome={() => setSelected(null)}
        onTrigger={onTrigger}
        onScenarioCreated={() => setTimeout(refreshList, 1500)}
        onReset={() => {
          setSelected(null);
          setRecord(null);
          setList([]);
          refreshList();
        }}
        busy={busy}
      />
      <main className="main">
        {!selected && (
          <Dashboard
            disputes={list}
            onSelect={setSelected}
            onTrigger={onTrigger}
            busy={busy}
          />
        )}
        {selected && (
          <>
            <button
              className="back-link"
              onClick={() => setSelected(null)}
              type="button"
            >
              ← Back to dashboard
            </button>
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
