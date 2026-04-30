import { useMemo } from "react";
import type { DisputeSummary } from "../types";
import {
  computeSubmittedSignals,
  formatMoney,
  formatRelTime,
  networkLabel,
  reasonLabel,
  type SubmittedSignals,
} from "../utils/priority";

interface Props {
  disputes: DisputeSummary[];
  onSelect: (id: string) => void;
}

interface Row {
  d: DisputeSummary;
  s: SubmittedSignals;
}

export function SubmittedDisputes({ disputes, onSelect }: Props) {
  const rows = useMemo<Row[]>(
    () =>
      disputes
        .filter((d) => d.status === "submitted")
        .map((d) => ({ d, s: computeSubmittedSignals(d) }))
        .sort((a, b) => b.s.submittedAt - a.s.submittedAt),
    [disputes],
  );

  const recovered = rows.reduce((sum, { s }) => sum + s.recoveredCents, 0);
  const atStake = rows.reduce((sum, { s }) => sum + s.fundsAtStakeCents, 0);
  const won = rows.filter(({ s }) => s.outcomeState === "won").length;
  const lost = rows.filter(({ s }) => s.outcomeState === "lost").length;
  const pending = rows.filter(
    ({ s }) =>
      s.outcomeState === "under_review" || s.outcomeState === "needs_response",
  ).length;
  const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : null;

  return (
    <section className="dash-section">
      <div className="section-head">
        <div>
          <h2>Submitted disputes</h2>
          <p className="muted">
            What's in flight with Stripe and the issuer. Outcomes can take
            30–75 days depending on network.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-card">
          <strong>Nothing submitted yet</strong>
          <span className="muted">
            Once you approve a dispute, it lands here with live status,
            response ETAs, and recovered funds.
          </span>
        </div>
      ) : (
        <>
          <div className="submitted-stats">
            <MiniStat
              label="Recovered"
              value={formatMoneyShort(recovered)}
              tone="good"
            />
            <MiniStat
              label="In review"
              value={pending.toString()}
              sub={pending === 1 ? "dispute" : "disputes"}
            />
            <MiniStat
              label="Win rate"
              value={winRate !== null ? `${winRate.toFixed(0)}%` : "—"}
              sub={
                won + lost > 0
                  ? `${won}W · ${lost}L`
                  : "no outcomes yet"
              }
              tone={winRate !== null && winRate >= 60 ? "good" : undefined}
            />
            <MiniStat
              label="At stake"
              value={formatMoneyShort(atStake)}
              sub={`${rows.length} submitted`}
            />
          </div>

          <ul className="submitted-list">
            {rows.map(({ d, s }) => (
              <SubmittedRow
                key={d.disputeId}
                d={d}
                s={s}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function SubmittedRow({
  d,
  s,
  onSelect,
}: {
  d: DisputeSummary;
  s: SubmittedSignals;
  onSelect: (id: string) => void;
}) {
  return (
    <li
      className={`submitted-row outcome-${s.outcomeState}`}
      onClick={() => onSelect(d.disputeId)}
    >
      <div className="srow-left">
        <NetworkBadge network={s.network} />
        <div className="srow-meta">
          <div className="srow-top">
            <span className="srow-amount">
              {formatMoney(d.amount, d.currency)}
            </span>
            <span className="reason-pill">
              {reasonLabel(d.reasonCode ?? d.reason)}
            </span>
          </div>
          <div className="srow-sub muted">
            <code className="srow-id">{d.disputeId}</code>
            <span className="dot">·</span>
            <span>Submitted {formatRelTime(s.submittedAt)}</span>
            {s.confidenceAtSubmit !== null && (
              <>
                <span className="dot">·</span>
                <span>
                  agent {s.confidenceAtSubmit}% confident at submit
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="srow-mid">
        <OutcomePill s={s} />
        {s.outcomeEtaDays !== null && s.outcomeState === "under_review" && (
          <EtaBar days={s.outcomeEtaDays} totalDays={75} />
        )}
        {s.outcomeState === "won" && (
          <span className="recovered">
            +{formatMoney(s.recoveredCents, d.currency)} recovered
          </span>
        )}
      </div>

      <div className="srow-right">
        <a
          href={s.receiptUrl}
          target="_blank"
          rel="noreferrer"
          className="srow-link"
          onClick={(e) => e.stopPropagation()}
          title="Open in Stripe Dashboard"
        >
          Stripe ↗
        </a>
        <span className="srow-cta">View →</span>
      </div>
    </li>
  );
}

function OutcomePill({ s }: { s: SubmittedSignals }) {
  const cls = {
    won: "out-won",
    lost: "out-lost",
    under_review: "out-review",
    warning_closed: "out-warning",
    needs_response: "out-alert",
  }[s.outcomeState];
  const icon = {
    won: "✓",
    lost: "✕",
    under_review: "◴",
    warning_closed: "○",
    needs_response: "!",
  }[s.outcomeState];
  return (
    <span className={`outcome-pill ${cls}`}>
      <span className="outcome-icon">{icon}</span>
      {s.outcomeLabel}
    </span>
  );
}

function EtaBar({ days, totalDays }: { days: number; totalDays: number }) {
  const elapsed = Math.max(0, totalDays - days);
  const pct = Math.min(100, (elapsed / totalDays) * 100);
  return (
    <div className="eta-bar" title={`~${days} days until issuer responds`}>
      <div className="eta-track">
        <div className="eta-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="eta-label muted">~{days}d</span>
    </div>
  );
}

function NetworkBadge({ network }: { network: SubmittedSignals["network"] }) {
  return (
    <span className={`network-badge net-${network}`} title={networkLabel(network)}>
      {networkLabel(network)}
    </span>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className={`mini-stat ${tone ? `mini-${tone}` : ""}`}>
      <div className="mini-label">{label}</div>
      <div className="mini-value">{value}</div>
      {sub && <div className="mini-sub muted">{sub}</div>}
    </div>
  );
}

function formatMoneyShort(cents: number): string {
  const v = cents / 100;
  if (v >= 10000) return `$${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}k`;
  return `$${v.toFixed(2)}`;
}
