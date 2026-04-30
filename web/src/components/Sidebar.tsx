import { useEffect, useMemo, useRef, useState } from "react";
import type { DisputeSummary } from "../types";
import { ScenarioCreator } from "./ScenarioCreator";
import { resetDatabase } from "../api";
import { computeSignals, formatMoney, reasonLabel } from "../utils/priority";

interface Props {
  items: DisputeSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
  onHome: () => void;
  onTrigger: () => void;
  onScenarioCreated: () => void;
  onReset: () => void;
  busy: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#666",
  running: "#fbbf24",
  ready: "#3b82f6",
  submitted: "#22c55e",
  error: "#ef4444",
};

export function Sidebar({
  items,
  selected,
  onSelect,
  onHome,
  onTrigger,
  onScenarioCreated,
  onReset,
  busy,
}: Props) {
  const [showScenario, setShowScenario] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!confirmReset) return;
    confirmTimer.current = window.setTimeout(() => setConfirmReset(false), 4000);
    return () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    };
  }, [confirmReset]);

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setResetting(true);
    try {
      await resetDatabase();
      onReset();
    } finally {
      setResetting(false);
    }
  };

  const ranked = useMemo(() => {
    return items
      .map((d) => ({ d, s: computeSignals(d) }))
      .sort((a, b) => {
        if (a.s.priorityScore !== b.s.priorityScore) {
          return b.s.priorityScore - a.s.priorityScore;
        }
        return b.d.updatedAt - a.d.updatedAt;
      });
  }, [items]);

  const needsYouCount = ranked.filter(
    ({ s }) => s.reviewState === "needs_you" || s.reviewState === "error",
  ).length;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button
          className="brand-button"
          onClick={onHome}
          title="Back to dashboard"
        >
          <img src="/logo.png" alt="" className="brand-mark" />
          <span>Chargebucks</span>
        </button>
        <div className="sidebar-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowScenario((v) => !v)}
            disabled={busy}
          >
            {showScenario ? "Hide scenario" : "+ Create scenario"}
          </button>
          <button
            className="btn"
            onClick={onTrigger}
            disabled={busy}
            title="Run: stripe trigger charge.dispute.created"
          >
            Quick trigger (mock)
          </button>
          <button
            className={`btn btn-danger ${confirmReset ? "btn-danger-armed" : ""}`}
            onClick={handleReset}
            disabled={busy || resetting}
            title="Wipe DB rows and trace files; re-seed products + customers"
          >
            {resetting
              ? "Resetting…"
              : confirmReset
                ? "Click again to confirm"
                : "Reset DB"}
          </button>
        </div>
      </div>

      {showScenario && <ScenarioCreator onCreated={onScenarioCreated} />}

      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${selected === null ? "active" : ""}`}
          onClick={onHome}
        >
          <span className="nav-icon">▦</span>
          <span>Dashboard</span>
          {needsYouCount > 0 && (
            <span className="nav-badge">{needsYouCount}</span>
          )}
        </button>
      </nav>

      <div className="sidebar-section-label">
        <span>All disputes</span>
        <span className="muted">{ranked.length}</span>
      </div>

      <ul className="dispute-list">
        {ranked.length === 0 && (
          <li className="empty-list">No disputes yet</li>
        )}
        {ranked.map(({ d, s }) => {
          const flagged =
            s.reviewState === "needs_you" || s.reviewState === "error";
          return (
            <li
              key={d.disputeId}
              className={`dispute-item ${selected === d.disputeId ? "active" : ""} ${flagged ? "flagged" : ""}`}
              onClick={() => onSelect(d.disputeId)}
            >
              <div className="dispute-item-row">
                <span
                  className="status-dot"
                  style={{ background: STATUS_COLOR[d.status] ?? "#666" }}
                />
                <span className="dispute-id">{d.disputeId}</span>
                <span
                  className={`prio-pip prio-${s.priority}`}
                  title={`Priority: ${s.priority}`}
                />
              </div>
              <div className="dispute-item-row meta">
                <span>{formatMoney(d.amount, d.currency)}</span>
                <span className="reason-pill">
                  {reasonLabel(d.reasonCode ?? d.reason)}
                </span>
              </div>
              {flagged && <div className="dispute-flag">⚠ needs you</div>}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
