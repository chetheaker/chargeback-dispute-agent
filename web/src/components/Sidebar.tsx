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
  pending: "#5e6d65",
  running: "#e3b341",
  ready: "#4cb8a8",
  submitted: "#34c77c",
  won: "#34c77c",
  lost: "#e26b6b",
  error: "#e26b6b",
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
  const [demoOpen, setDemoOpen] = useState(false);
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

  const openCount = ranked.filter(
    ({ d }) => d.status !== "submitted" && d.status !== "error",
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
      </div>

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

      <div className="sidebar-quickstats">
        <div className="sqs-tile">
          <div className="sqs-label">Open</div>
          <div className="sqs-value">{openCount}</div>
        </div>
        <div className={`sqs-tile ${needsYouCount > 0 ? "alert" : "good"}`}>
          <div className="sqs-label">Needs you</div>
          <div className="sqs-value">{needsYouCount}</div>
        </div>
      </div>

      <div className="sidebar-section-label">
        <span>Disputes queue</span>
        <span className="muted">{ranked.length}</span>
      </div>

      <ul className="dispute-list">
        {ranked.length === 0 && (
          <li className="empty-list">No disputes yet — open Demo tools to create one.</li>
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
                  style={{ background: STATUS_COLOR[d.status] ?? "#5e6d65" }}
                />
                <span className="dispute-id">{d.disputeId}</span>
                <span
                  className={`prio-pip prio-${s.priority}`}
                  title={`Priority: ${s.priority}`}
                />
              </div>
              <div className="dispute-item-row meta">
                <span className="dispute-amount">
                  {formatMoney(d.amount, d.currency)}
                </span>
                <span className="reason-pill">
                  {reasonLabel(d.reasonCode ?? d.reason)}
                </span>
              </div>
              {flagged && <div className="dispute-flag">⚠ needs you</div>}
            </li>
          );
        })}
      </ul>

      <div className="demo-tools">
        <button
          className={`demo-tools-toggle ${demoOpen ? "open" : ""}`}
          onClick={() => setDemoOpen((v) => !v)}
          aria-expanded={demoOpen}
          title="Demo controls — create scenarios, trigger, or reset"
        >
          <span className="demo-tools-icon">⚙</span>
          <span>Demo tools</span>
          <span className="chev">▶</span>
        </button>
        {demoOpen && (
          <div className="demo-tools-body">
            <ScenarioCreator onCreated={onScenarioCreated} />
            <div className="demo-tools-actions">
              <button
                className="btn btn-ghost"
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
                    : "Reset database"}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
