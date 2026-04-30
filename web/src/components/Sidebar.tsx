import type { DisputeSummary } from "../types";

interface Props {
  items: DisputeSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
  onTrigger: () => void;
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
  onTrigger,
  busy,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">CB</span>
          <span>Disputes</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={onTrigger}
          disabled={busy}
          title="Run: stripe trigger charge.dispute.created"
        >
          + New test dispute
        </button>
      </div>
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
              <span>{(d.amount / 100).toFixed(2)} {d.currency.toUpperCase()}</span>
              <span className="reason-pill">{d.reasonCode ?? d.reason}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
