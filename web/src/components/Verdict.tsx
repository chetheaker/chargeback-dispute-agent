import type { AgentResult } from "../types";

interface Props {
  result: AgentResult | null;
}

export function Verdict({ result }: Props) {
  if (!result) {
    return (
      <section className="panel verdict">
        <h2>Verdict</h2>
        <div className="muted">Agent has not finalized yet.</div>
      </section>
    );
  }
  return (
    <section className="panel verdict">
      <div className="verdict-head">
        <h2>Verdict</h2>
        <span className="reason-pill big">{result.reasonCode}</span>
      </div>
      <div className="narrative">{renderNarrative(result.narrative)}</div>
      <div className="cited">
        <span className="muted">Cited:</span>{" "}
        {result.citedEvidenceIds.map((id) => (
          <a key={id} href={`#ev-${id}`} className="citation">
            {id}
          </a>
        ))}
      </div>
    </section>
  );
}

function renderNarrative(text: string) {
  const parts: (string | { id: string })[] = [];
  const re = /\[(ev_[a-zA-Z0-9_-]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ id: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <a key={i} href={`#ev-${p.id}`} className="citation inline">
        [{p.id}]
      </a>
    ),
  );
}
