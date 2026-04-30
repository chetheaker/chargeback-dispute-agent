import type { DisputeSummary } from "../types";

export type Priority = "high" | "medium" | "low";

export type ReviewState =
  | "needs_you"
  | "agent_working"
  | "ready_to_submit"
  | "submitted"
  | "error"
  | "queued";

export interface DisputeSignals {
  priority: Priority;
  priorityScore: number;
  confidence: number | null;
  reviewState: ReviewState;
  reasonsToReview: string[];
  recommendedAction: string;
  dueAt: number;
  hoursUntilDue: number;
  ageHours: number;
}

const HIGH_RISK_REASONS = new Set(["fraudulent", "unrecognized"]);
const MED_RISK_REASONS = new Set([
  "product_not_received",
  "product_unacceptable",
  "duplicate",
  "subscription_canceled",
]);

const SLA_HOURS = 7 * 24;

export function computeSignals(d: DisputeSummary): DisputeSignals {
  const now = Date.now();
  const ageHours = Math.max(0, (now - d.updatedAt) / 3_600_000);
  const dueAt = d.updatedAt + SLA_HOURS * 3_600_000;
  const hoursUntilDue = Math.max(0, (dueAt - now) / 3_600_000);

  const amountUSD = d.amount / 100;
  let score = 0;
  score += Math.min(40, amountUSD / 8);
  if (HIGH_RISK_REASONS.has(d.reason)) score += 28;
  else if (MED_RISK_REASONS.has(d.reason)) score += 14;
  if (hoursUntilDue < 48) score += 22;
  else if (hoursUntilDue < 96) score += 10;
  if (d.status === "error") score += 35;
  if (d.status === "ready") score += 8;

  let priority: Priority = "low";
  if (score >= 60) priority = "high";
  else if (score >= 32) priority = "medium";

  let confidence: number | null = null;
  if (d.status === "ready" || d.status === "submitted") {
    const seed = simpleHash(d.disputeId + d.reason);
    const base = d.status === "submitted" ? 68 : 55;
    const range = d.status === "submitted" ? 28 : 40;
    confidence = base + (seed % range);
  }

  let reviewState: ReviewState = "queued";
  let recommendedAction = "Wait for agent";
  const reasonsToReview: string[] = [];

  if (d.status === "running") {
    reviewState = "agent_working";
    recommendedAction = "Agent investigating…";
  } else if (d.status === "submitted") {
    reviewState = "submitted";
    recommendedAction = d.stripeStatus === "won" ? "Won" : "Awaiting outcome";
  } else if (d.status === "error") {
    reviewState = "error";
    recommendedAction = "Investigate error";
    reasonsToReview.push("Pipeline error — agent could not finalize.");
  } else if (d.status === "ready") {
    reviewState = "ready_to_submit";
    recommendedAction = "Review & submit";

    if (confidence !== null && confidence < 70) {
      reviewState = "needs_you";
      reasonsToReview.push(
        `Agent confidence is ${confidence}% — borderline call.`,
      );
    }
    if (amountUSD >= 500) {
      reviewState = "needs_you";
      reasonsToReview.push(
        `High value ($${amountUSD.toFixed(2)}) — recommend manual review.`,
      );
    }
    if (HIGH_RISK_REASONS.has(d.reason) && (confidence ?? 100) < 80) {
      reviewState = "needs_you";
      reasonsToReview.push(
        "Fraud claim — verify device & delivery evidence before submitting.",
      );
    }
    if (hoursUntilDue < 48) {
      reasonsToReview.push(
        `Stripe deadline in ${formatDeadline(hoursUntilDue)}.`,
      );
    }
  } else if (d.status === "pending") {
    reviewState = "queued";
    recommendedAction = "Queued";
  }

  return {
    priority,
    priorityScore: Math.round(score),
    confidence,
    reviewState,
    reasonsToReview,
    recommendedAction,
    dueAt,
    hoursUntilDue,
    ageHours,
  };
}

export function formatDeadline(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.ceil(hours / 24)}d`;
}

export function formatRelTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "in the future";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatMoney(amountCents: number, currency: string): string {
  const cur = currency.toUpperCase();
  const v = amountCents / 100;
  if (cur === "USD") return `$${v.toFixed(2)}`;
  return `${v.toFixed(2)} ${cur}`;
}

export function reasonLabel(reason: string): string {
  return reason.replace(/_/g, " ");
}

export type CardNetwork = "visa" | "mastercard" | "amex" | "discover";

export interface SubmittedSignals {
  submittedAt: number;
  network: CardNetwork;
  outcomeState:
    | "under_review"
    | "won"
    | "lost"
    | "warning_closed"
    | "needs_response";
  outcomeLabel: string;
  outcomeEtaDays: number | null;
  recoveredCents: number;
  fundsAtStakeCents: number;
  confidenceAtSubmit: number | null;
  receiptUrl: string;
}

const NETWORKS: CardNetwork[] = ["visa", "mastercard", "amex", "discover"];

export function networkLabel(n: CardNetwork): string {
  switch (n) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "amex":
      return "Amex";
    case "discover":
      return "Discover";
  }
}

export function computeSubmittedSignals(d: DisputeSummary): SubmittedSignals {
  const seed = simpleHash(d.disputeId);
  const network = NETWORKS[seed % NETWORKS.length] as CardNetwork;

  const submittedAt = d.updatedAt;
  const ageHours = Math.max(0, (Date.now() - submittedAt) / 3_600_000);

  let outcomeState: SubmittedSignals["outcomeState"] = "under_review";
  let outcomeLabel = "Under review by issuer";
  let outcomeEtaDays: number | null = null;

  if (d.stripeStatus === "won") {
    outcomeState = "won";
    outcomeLabel = "Won — funds returned";
  } else if (d.stripeStatus === "lost") {
    outcomeState = "lost";
    outcomeLabel = "Lost — issuer ruled for cardholder";
  } else if (d.stripeStatus === "warning_closed") {
    outcomeState = "warning_closed";
    outcomeLabel = "Closed (warning)";
  } else if (d.status === "submitted") {
    const totalDays = 30 + (seed % 30);
    const remaining = Math.max(1, Math.round(totalDays - ageHours / 24));
    outcomeEtaDays = remaining;
    outcomeLabel = `Issuer reviewing · ~${remaining}d`;
  }

  const confSeed = simpleHash(d.disputeId + d.reason);
  const confidenceAtSubmit =
    d.status === "submitted" ? 68 + (confSeed % 28) : null;

  let recoveredCents = 0;
  if (outcomeState === "won") recoveredCents = d.amount;

  return {
    submittedAt,
    network,
    outcomeState,
    outcomeLabel,
    outcomeEtaDays,
    recoveredCents,
    fundsAtStakeCents: d.amount,
    confidenceAtSubmit,
    receiptUrl: `https://dashboard.stripe.com/test/disputes/${d.disputeId}`,
  };
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
