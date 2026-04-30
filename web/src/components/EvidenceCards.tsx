import { useState } from "react";
import type { EvidenceRecord } from "../types";

interface Props {
  records: EvidenceRecord[];
}

const KIND_ICON: Record<string, string> = {
  order: "🛒",
  comms: "✉",
  device: "🖥",
  delivery: "📦",
  history: "📊",
  terms: "📜",
};

export function EvidenceCards({ records }: Props) {
  if (records.length === 0) {
    return (
      <section className="panel">
        <h2>Evidence</h2>
        <div className="muted">No evidence gathered yet.</div>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>
        Evidence <span className="count">{records.length}</span>
      </h2>
      <div className="evidence-grid">
        {records.map((r) => (
          <EvidenceCard key={r.id} rec={r} />
        ))}
      </div>
    </section>
  );
}

function EvidenceCard({ rec }: { rec: EvidenceRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <article id={`ev-${rec.id}`} className="evidence-card">
      <header onClick={() => setOpen((v) => !v)}>
        <span className="kind-icon">{KIND_ICON[rec.kind] ?? "•"}</span>
        <div className="evidence-meta">
          <code className="evidence-id">{rec.id}</code>
          <div className="kind-label">{rec.kind}</div>
        </div>
        <span className="chevron">{open ? "▾" : "▸"}</span>
      </header>
      <div className="evidence-summary">{rec.summary}</div>
      {open && rec.data !== undefined && (
        <pre className="evidence-data">
          {JSON.stringify(rec.data, null, 2)}
        </pre>
      )}
    </article>
  );
}
