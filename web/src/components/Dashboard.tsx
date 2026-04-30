import { useMemo, useState } from "react";
import type { DisputeSummary } from "../types";
import {
  computeSignals,
  computeSubmittedSignals,
  formatDeadline,
  formatMoney,
  formatRelTime,
  reasonLabel,
  type DisputeSignals,
  type Priority,
} from "../utils/priority";
import { HowItWorks } from "./HowItWorks";
import { SubmittedDisputes } from "./SubmittedDisputes";

interface Props {
  disputes: DisputeSummary[];
  onSelect: (id: string) => void;
  onTrigger: () => void;
  busy: boolean;
}

type Filter = "all" | "open" | "needs_you" | "ready" | "submitted";
type View = "table" | "kanban";

interface Row {
  d: DisputeSummary;
  s: DisputeSignals;
}

export function Dashboard({ disputes, onSelect, onTrigger, busy }: Props) {
  const [filter, setFilter] = useState<Filter>("open");
  const [view, setView] = useState<View>("kanban");

  const rows = useMemo<Row[]>(
    () =>
      disputes.map((d) => ({
        d,
        s: computeSignals(d),
      })),
    [disputes],
  );

  const open = rows.filter(
    ({ d }) => d.status !== "submitted" && d.status !== "error",
  );
  const submitted = rows.filter(({ d }) => d.status === "submitted");
  const needsYou = rows.filter(
    ({ s }) => s.reviewState === "needs_you" || s.reviewState === "error",
  );

  // Value-focused outcome stats derived from submitted signals
  const submittedAgg = useMemo(() => {
    const sigs = submitted.map(({ d }) => ({
      d,
      x: computeSubmittedSignals(d),
    }));
    const recoveredCents = sigs.reduce(
      (sum, { x }) => sum + x.recoveredCents,
      0,
    );
    const inReview = sigs.filter(
      ({ x }) =>
        x.outcomeState === "under_review" ||
        x.outcomeState === "needs_response",
    );
    const inReviewCents = inReview.reduce(
      (sum, { x }) => sum + x.fundsAtStakeCents,
      0,
    );
    const won = sigs.filter(({ x }) => x.outcomeState === "won").length;
    const lost = sigs.filter(({ x }) => x.outcomeState === "lost").length;
    const decided = won + lost;
    const winRate = decided > 0 ? (won / decided) * 100 : null;
    return {
      recoveredCents,
      inReviewCount: inReview.length,
      inReviewCents,
      won,
      lost,
      winRate,
    };
  }, [submitted]);

  const filtered = useMemo(() => {
    const list = applyFilter(rows, filter);
    return list.sort((a, b) => {
      if (a.s.priorityScore !== b.s.priorityScore) {
        return b.s.priorityScore - a.s.priorityScore;
      }
      return b.d.updatedAt - a.d.updatedAt;
    });
  }, [rows, filter]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <div className="eyebrow-row">
            <div className="eyebrow">
              <span className="dashboard-eyebrow-divider" />
              Inbox
            </div>
            <HowItWorks />
          </div>
          <h1>Disputes</h1>
          <p className="dashboard-sub">
            The agent investigates each chargeback and surfaces the ones you
            need to decide on. Approve, edit, or skip — never start from a
            blank page.
          </p>
        </div>
        <div className="dashboard-actions">
          <button
            className="btn btn-primary"
            onClick={onTrigger}
            disabled={busy}
            title="Run: stripe trigger charge.dispute.created"
          >
            + New test dispute
          </button>
        </div>
      </header>

      <div className="stats-row stats-row-4">
        <StatCard
          label="Recovered"
          value={shortMoney(submittedAgg.recoveredCents)}
          sublabel={
            submittedAgg.won > 0
              ? `${submittedAgg.won} dispute${submittedAgg.won === 1 ? "" : "s"} won`
              : "no wins yet"
          }
          tone={submittedAgg.recoveredCents > 0 ? "good" : undefined}
        />
        <StatCard
          label="In review"
          value={submittedAgg.inReviewCount.toString()}
          sublabel={
            submittedAgg.inReviewCents > 0
              ? `${shortMoney(submittedAgg.inReviewCents)} waiting on issuer`
              : "nothing waiting"
          }
        />
        <StatCard
          label="Needs your attention"
          value={needsYou.length.toString()}
          sublabel={
            needsYou.length > 0
              ? "review before submitting"
              : "you're all caught up"
          }
          tone={needsYou.length > 0 ? "alert" : "good"}
        />
        <StatCard
          label="Win rate"
          value={
            submittedAgg.winRate !== null
              ? `${submittedAgg.winRate.toFixed(0)}%`
              : "—"
          }
          sublabel={
            submittedAgg.won + submittedAgg.lost > 0
              ? `${submittedAgg.won}W · ${submittedAgg.lost}L`
              : "no outcomes yet"
          }
          tone={
            submittedAgg.winRate !== null && submittedAgg.winRate >= 60
              ? "good"
              : undefined
          }
        />
      </div>

      {needsYou.length > 0 && (
        <section className="dash-section needs-section">
          <div className="section-head">
            <div>
              <h2>Needs your attention</h2>
              <p className="muted">
                The agent flagged these for human review — a borderline call,
                a high-value claim, or a tight deadline.
              </p>
            </div>
          </div>
          <div className="needs-grid">
            {needsYou.map(({ d, s }) => (
              <NeedsCard
                key={d.disputeId}
                d={d}
                s={s}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      )}

      <SubmittedDisputes disputes={disputes} onSelect={onSelect} />

      <section className="dash-section">
        <div className="section-head">
          <div>
            <h2>Active queue</h2>
            <p className="muted">
              Disputes the agent is investigating or has prepped for review.
              Ranked by amount, deadline, and reason risk.
            </p>
          </div>
          <div className="view-toggle" role="tablist" aria-label="View">
            <button
              className={view === "table" ? "active" : ""}
              onClick={() => setView("table")}
              type="button"
              title="Table view"
            >
              <span className="vt-icon">☰</span> Table
            </button>
            <button
              className={view === "kanban" ? "active" : ""}
              onClick={() => setView("kanban")}
              type="button"
              title="Kanban view"
            >
              <span className="vt-icon">▦</span> Kanban
            </button>
          </div>
        </div>

        <div className="dashboard-toolbar">
          <div className="filter-chips">
            <Chip active={filter === "open"} onClick={() => setFilter("open")}>
              Open · {open.length}
            </Chip>
            <Chip
              active={filter === "needs_you"}
              onClick={() => setFilter("needs_you")}
              tone={needsYou.length > 0 ? "alert" : undefined}
            >
              Needs you · {needsYou.length}
            </Chip>
            <Chip
              active={filter === "ready"}
              onClick={() => setFilter("ready")}
            >
              Ready · {rows.filter((r) => r.d.status === "ready").length}
            </Chip>
            <Chip
              active={filter === "submitted"}
              onClick={() => setFilter("submitted")}
            >
              Submitted · {submitted.length}
            </Chip>
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              All · {rows.length}
            </Chip>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState filter={filter} onTrigger={onTrigger} busy={busy} />
        ) : view === "kanban" ? (
          <KanbanBoard rows={filtered} onSelect={onSelect} />
        ) : (
          <PriorityTable rows={filtered} onSelect={onSelect} />
        )}
      </section>

    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "good" | "warn" | "alert";
}) {
  return (
    <div className={`stat-card ${tone ? `stat-${tone}` : ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sublabel && <div className="stat-sublabel">{sublabel}</div>}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  tone?: "alert";
}) {
  return (
    <button
      className={`chip ${active ? "active" : ""} ${tone ? `chip-${tone}` : ""}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`priority-badge priority-${priority}`}>{priority}</span>;
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="muted small">—</span>;
  }
  const tone = value >= 80 ? "good" : value >= 65 ? "ok" : "low";
  return (
    <div className="conf-wrap" title={`Agent confidence: ${value}%`}>
      <div className={`conf-bar conf-${tone}`}>
        <div className="conf-fill" style={{ width: `${value}%` }} />
      </div>
      <span className={`conf-num conf-${tone}`}>{value}%</span>
    </div>
  );
}

function StateBadge({ s, d }: { s: DisputeSignals; d: DisputeSummary }) {
  const map: Record<string, { label: string; cls: string }> = {
    needs_you: { label: "Needs you", cls: "state-alert" },
    agent_working: { label: "Agent working", cls: "state-running" },
    ready_to_submit: { label: "Ready", cls: "state-ready" },
    submitted: {
      label: d.stripeStatus === "won" ? "Won" : "Submitted",
      cls: d.stripeStatus === "won" ? "state-won" : "state-submitted",
    },
    error: { label: "Error", cls: "state-error" },
    queued: { label: "Queued", cls: "state-queued" },
  };
  const m = map[s.reviewState] ?? { label: s.reviewState, cls: "state-queued" };
  return <span className={`state-badge ${m.cls}`}>{m.label}</span>;
}

function PriorityTable({
  rows,
  onSelect,
}: {
  rows: Row[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="queue-table">
      <div className="queue-head">
        <div>Priority</div>
        <div>Amount</div>
        <div>Reason</div>
        <div>Confidence</div>
        <div>Deadline</div>
        <div>State</div>
        <div className="ta-right">Action</div>
      </div>
      {rows.map(({ d, s }) => (
        <div
          key={d.disputeId}
          className="queue-row"
          onClick={() => onSelect(d.disputeId)}
        >
          <div>
            <PriorityBadge priority={s.priority} />
          </div>
          <div className="cell-amount">
            <span className="cell-amount-value">
              {formatMoney(d.amount, d.currency)}
            </span>
            <span className="muted small">{formatRelTime(d.updatedAt)}</span>
          </div>
          <div>
            <span className="reason-pill">
              {reasonLabel(d.reasonCode ?? d.reason)}
            </span>
          </div>
          <div>
            <ConfidenceBar value={s.confidence} />
          </div>
          <div
            className={
              s.hoursUntilDue < 48
                ? "cell-deadline urgent"
                : "cell-deadline"
            }
          >
            {d.status === "submitted" ? (
              <span className="muted small">—</span>
            ) : (
              formatDeadline(s.hoursUntilDue)
            )}
          </div>
          <div>
            <StateBadge s={s} d={d} />
          </div>
          <div className="ta-right cell-action muted small">
            {s.recommendedAction} →
          </div>
        </div>
      ))}
    </div>
  );
}

type KanbanColumn = {
  id: "needs" | "working" | "ready" | "submitted";
  title: string;
  description: string;
};

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "needs", title: "Needs you", description: "Agent flagged for review" },
  { id: "working", title: "Agent working", description: "Investigating evidence" },
  { id: "ready", title: "Ready to submit", description: "Approve or edit" },
  { id: "submitted", title: "Submitted", description: "In flight with Stripe" },
];

function bucketFor(row: Row): KanbanColumn["id"] | null {
  const { s, d } = row;
  if (s.reviewState === "needs_you" || s.reviewState === "error") return "needs";
  if (s.reviewState === "agent_working" || d.status === "running") return "working";
  if (s.reviewState === "ready_to_submit" || d.status === "ready") return "ready";
  if (s.reviewState === "submitted" || d.status === "submitted") return "submitted";
  if (d.status === "pending") return "working";
  return null;
}

function KanbanBoard({
  rows,
  onSelect,
}: {
  rows: Row[];
  onSelect: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const out: Record<KanbanColumn["id"], Row[]> = {
      needs: [],
      working: [],
      ready: [],
      submitted: [],
    };
    for (const r of rows) {
      const b = bucketFor(r);
      if (b) out[b].push(r);
    }
    for (const k of Object.keys(out) as KanbanColumn["id"][]) {
      out[k].sort((a, b) => {
        if (a.s.priorityScore !== b.s.priorityScore) {
          return b.s.priorityScore - a.s.priorityScore;
        }
        return b.d.updatedAt - a.d.updatedAt;
      });
    }
    return out;
  }, [rows]);

  return (
    <div className="kanban">
      {KANBAN_COLUMNS.map((col) => {
        const items = grouped[col.id];
        return (
          <div key={col.id} className={`kanban-col col-${col.id}`}>
            <div className="kanban-col-head">
              <span className="kanban-col-pulse" />
              <span className="kanban-col-title">{col.title}</span>
              <span className="kanban-col-count">{items.length}</span>
            </div>
            <div className="kanban-cards">
              {items.length === 0 ? (
                <div className="kanban-empty">{col.description}</div>
              ) : (
                items.map((row) => (
                  <KanbanCard
                    key={row.d.disputeId}
                    row={row}
                    onSelect={onSelect}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  row,
  onSelect,
}: {
  row: Row;
  onSelect: (id: string) => void;
}) {
  const { d, s } = row;
  const urgent = s.hoursUntilDue < 48 && d.status !== "submitted";
  return (
    <article
      className="kanban-card"
      onClick={() => onSelect(d.disputeId)}
    >
      <div className="kanban-card-top">
        <span className="kanban-card-amount">
          {formatMoney(d.amount, d.currency)}
        </span>
        <PriorityBadge priority={s.priority} />
      </div>
      <div className="kanban-card-mid">
        <span className="reason-pill">
          {reasonLabel(d.reasonCode ?? d.reason)}
        </span>
      </div>
      {s.confidence !== null && <ConfidenceBar value={s.confidence} />}
      <div className={`kanban-card-foot ${urgent ? "urgent" : ""}`}>
        <span>
          {d.status === "submitted"
            ? formatRelTime(d.updatedAt)
            : formatDeadline(s.hoursUntilDue) + " left"}
        </span>
        <span className="muted small">{s.recommendedAction} →</span>
      </div>
    </article>
  );
}

function NeedsCard({
  d,
  s,
  onSelect,
}: {
  d: DisputeSummary;
  s: DisputeSignals;
  onSelect: (id: string) => void;
}) {
  return (
    <article className="needs-card" onClick={() => onSelect(d.disputeId)}>
      <header className="needs-card-head">
        <PriorityBadge priority={s.priority} />
        <span className="reason-pill">
          {reasonLabel(d.reasonCode ?? d.reason)}
        </span>
        <span className="needs-amount">
          {formatMoney(d.amount, d.currency)}
        </span>
      </header>
      <ul className="needs-reasons">
        {s.reasonsToReview.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <footer className="needs-card-foot">
        <ConfidenceBar value={s.confidence} />
        <span className="needs-cta">Review →</span>
      </footer>
    </article>
  );
}

function EmptyState({
  filter,
  onTrigger,
  busy,
}: {
  filter: Filter;
  onTrigger: () => void;
  busy: boolean;
}) {
  if (filter === "needs_you") {
    return (
      <div className="empty-card">
        <strong>All clear</strong>
        <span className="muted">
          The agent is confident on every open dispute. Review the queue when
          you're ready.
        </span>
      </div>
    );
  }
  if (filter === "submitted") {
    return (
      <div className="empty-card">
        <strong>Nothing submitted yet</strong>
        <span className="muted">
          Once you approve a dispute, it'll show up here with the Stripe
          status.
        </span>
      </div>
    );
  }
  return (
    <div className="empty-card">
      <strong>Inbox zero</strong>
      <span className="muted">
        No disputes match this filter. Trigger a test to see the agent in
        action.
      </span>
      <button
        className="btn btn-primary"
        onClick={onTrigger}
        disabled={busy}
        style={{ marginTop: 12 }}
      >
        + New test dispute
      </button>
    </div>
  );
}

function applyFilter(rows: Row[], filter: Filter): Row[] {
  switch (filter) {
    case "open":
      return rows.filter(
        ({ d }) => d.status !== "submitted" && d.status !== "error",
      );
    case "needs_you":
      return rows.filter(
        ({ s }) =>
          s.reviewState === "needs_you" || s.reviewState === "error",
      );
    case "ready":
      return rows.filter(({ d }) => d.status === "ready");
    case "submitted":
      return rows.filter(({ d }) => d.status === "submitted");
    case "all":
    default:
      return rows;
  }
}

function shortMoney(cents: number): string {
  const v = cents / 100;
  if (v >= 10000) return `$${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}k`;
  return `$${v.toFixed(0)}`;
}

