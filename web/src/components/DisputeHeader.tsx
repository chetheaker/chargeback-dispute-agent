import type { DisputeRecord } from "../types";

interface Props {
  record: DisputeRecord | null;
  onSubmit: () => void;
  onRerun: () => void;
  busy: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "Agent running…",
  ready: "Ready to submit",
  submitted: "Submitted to Stripe",
  error: "Error",
};

export function DisputeHeader({ record, onSubmit, onRerun, busy }: Props) {
  if (!record) {
    return (
      <header className="dispute-header skeleton">
        <div className="loading-line" style={{ width: 240 }} />
        <div className="loading-line" style={{ width: 320 }} />
      </header>
    );
  }
  const c = record.context;
  return (
    <header className="dispute-header">
      <div>
        <div className="dispute-id-large">{c.disputeId}</div>
        <div className="dispute-sub">
          <span className="amount">
            {(c.amount / 100).toFixed(2)} {c.currency.toUpperCase()}
          </span>
          <span className="dot">·</span>
          <span className="reason-pill big">{record.result?.reasonCode ?? c.reason}</span>
          <span className="dot">·</span>
          <span className="charge-id">{c.chargeId}</span>
          {c.customerEmail && (
            <>
              <span className="dot">·</span>
              <span>{c.customerEmail}</span>
            </>
          )}
        </div>
      </div>
      <div className="header-actions">
        <span className={`status-badge status-${record.status}`}>
          {STATUS_LABEL[record.status] ?? record.status}
          {record.stripeStatus && ` · ${record.stripeStatus}`}
        </span>
        <button className="btn" onClick={onRerun} disabled={busy}>
          Re-run
        </button>
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={busy || record.status !== "ready"}
        >
          Submit to Stripe
        </button>
      </div>
    </header>
  );
}
