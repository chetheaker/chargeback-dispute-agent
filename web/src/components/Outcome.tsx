import { useState } from "react";
import type { DisputeRecord } from "../types";

interface Props {
  record: DisputeRecord;
  onChanged: () => void;
}

export function Outcome({ record, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const livemode = false;
  const dashboardUrl = `https://dashboard.stripe.com/${livemode ? "" : "test/"}disputes/${record.context.disputeId}`;

  const concede = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/disputes/${record.context.disputeId}/concede`,
        { method: "POST" },
      );
      if (!r.ok) throw new Error(await r.text());
      onChanged();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  // Final state — won/lost banner
  if (record.outcome) {
    const won = record.outcome === "won";
    const amount = `${(record.context.amount / 100).toFixed(2)} ${record.context.currency.toUpperCase()}`;
    return (
      <section className={`outcome ${won ? "outcome-won" : "outcome-lost"}`}>
        <div className="outcome-banner">
          <span className="outcome-icon">{won ? "✓" : "✕"}</span>
          <div className="outcome-text">
            <div className="outcome-title">
              Dispute {won ? "won" : "lost"}
            </div>
            <div className="outcome-sub">
              {won
                ? `Funds reinstated — ${amount} returned to merchant.`
                : `Funds withdrawn — ${amount} debited from merchant.`}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Submitted, awaiting outcome
  if (record.status === "submitted") {
    return (
      <section className="outcome outcome-pending">
        <div className="outcome-head">
          <h2>Awaiting Stripe outcome</h2>
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="dashboard-link"
          >
            Open in Stripe Dashboard →
          </a>
        </div>
        <p className="muted small">
          Evidence is staged with Stripe (status:{" "}
          <code>{record.stripeStatus ?? "submitted"}</code>). In test mode,
          click <strong>Mark as won</strong> or <strong>Mark as lost</strong> in
          the dashboard. Stripe will fire{" "}
          <code>charge.dispute.closed</code> and this view will update
          automatically.
        </p>
      </section>
    );
  }

  // Pre-submit — offer to concede via API
  if (record.status === "ready") {
    return (
      <section className="outcome outcome-pending">
        <div className="outcome-head">
          <h2>Decide</h2>
        </div>
        <p className="muted small">
          Either submit evidence above to fight the dispute, or concede now via{" "}
          <code>POST /v1/disputes/:id/close</code> to mark it lost without
          arguing.
        </p>
        {error && <div className="error">{error}</div>}
        <div className="outcome-actions">
          <button
            className="btn btn-danger-solid"
            onClick={concede}
            disabled={busy}
          >
            {busy ? "Conceding…" : "Concede via Stripe API"}
          </button>
        </div>
      </section>
    );
  }

  return null;
}
