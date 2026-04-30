import { useEffect, useRef, useState } from "react";
import type { DisputeSummary } from "../types";
import { ScenarioCreator } from "./ScenarioCreator";
import { resetDatabase } from "../api";

interface Props {
  items: DisputeSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
  onTrigger: () => void;
  onScenarioCreated: () => void;
  onReset: () => void;
  busy: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#666",
  running: "#fbbf24",
  ready: "#3b82f6",
  submitted: "#a394ff",
  won: "#22c55e",
  lost: "#ef4444",
  error: "#ef4444",
};

export function Sidebar({
  items,
  selected,
  onSelect,
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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">CB</span>
          <span>Disputes</span>
        </div>
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

      <ul className="dispute-list">
        {items.length === 0 && (
          <li className="empty-list">No disputes yet</li>
        )}
        {items.map((d) => (
          <li
            key={d.disputeId}
            className={`dispute-item ${selected === d.disputeId ? "active" : ""}`}
            onClick={() => onSelect(d.disputeId)}
          >
            <div className="dispute-item-row">
              <span
                className="status-dot"
                style={{ background: STATUS_COLOR[d.status] ?? "#666" }}
              />
              <span className="dispute-id">{d.disputeId}</span>
            </div>
            <div className="dispute-item-row meta">
              <span>
                {(d.amount / 100).toFixed(2)} {d.currency.toUpperCase()}
              </span>
              <span className="reason-pill">{d.reasonCode ?? d.reason}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
