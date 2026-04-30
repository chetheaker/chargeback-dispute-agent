import type { AgentResult } from "../types";

interface Props {
  result: AgentResult | null;
}

export function StripePayload({ result }: Props) {
  if (!result) return null;
  const textKeys = Object.keys(result.evidenceText);
  const fileKeys = Object.keys(result.evidenceFileContent);
  return (
    <section className="panel">
      <h2>Stripe submission</h2>
      <div className="payload">
        <div className="payload-section">
          <div className="payload-label">Text fields ({textKeys.length})</div>
          {textKeys.map((k) => (
            <div key={k} className="kv">
              <code className="key">{k}</code>
              <span className="val">{trim(result.evidenceText[k] ?? "")}</span>
            </div>
          ))}
        </div>
        <div className="payload-section">
          <div className="payload-label">
            File fields ({fileKeys.length}) — uploaded as text/plain
          </div>
          {fileKeys.map((k) => (
            <div key={k} className="kv">
              <code className="key">{k}</code>
              <span className="val muted">
                {trim(result.evidenceFileContent[k] ?? "")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function trim(s: string) {
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}
