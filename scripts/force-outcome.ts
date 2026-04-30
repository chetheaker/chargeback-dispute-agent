/**
 * Locally simulate a dispute outcome by signing a charge.dispute.closed (and
 * funds_reinstated/funds_withdrawn) webhook with STRIPE_WEBHOOK_SECRET and
 * POSTing it to the running server. Drives the SAME code path our handler
 * uses for real Stripe webhooks.
 *
 * Limitation: this updates LOCAL state only. Stripe's dispute record is
 * untouched — the dashboard will still show under_review. For real Stripe
 * state transitions use the dashboard "Mark as won/lost" buttons.
 *
 * Usage:
 *   bun run scripts/force-outcome.ts <disputeId> <won|lost>
 *   bun run force:outcome du_xxx won
 */

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

const [, , disputeId, outcomeArg] = process.argv;
const outcome = outcomeArg as "won" | "lost" | undefined;

if (!disputeId || (outcome !== "won" && outcome !== "lost")) {
  console.error(
    "Usage: bun run scripts/force-outcome.ts <disputeId> <won|lost>",
  );
  process.exit(1);
}

const secret = process.env.STRIPE_WEBHOOK_SECRET;
if (!secret) {
  console.error("STRIPE_WEBHOOK_SECRET not set in env");
  process.exit(1);
}

const PORT = process.env.PORT ?? "3000";
const url = `http://localhost:${PORT}/webhook`;

const recordPath = `traces/${disputeId}.record.json`;
let record: any;
try {
  record = JSON.parse(await readFile(recordPath, "utf8"));
} catch (err) {
  console.error(`Could not read ${recordPath}: ${err}`);
  process.exit(1);
}
const ctx = record.context;

function signStripeWebhook(payload: string, webhookSecret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function buildEvent(type: string, status: string) {
  return {
    id: `evt_local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2024-09-30.acacia",
    created: Math.floor(Date.now() / 1000),
    type,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: ctx.disputeId,
        object: "dispute",
        amount: ctx.amount,
        charge: ctx.chargeId,
        payment_intent: ctx.paymentIntentId ?? null,
        created: Math.floor(ctx.createdAt / 1000),
        currency: ctx.currency,
        reason: ctx.reason,
        status,
        is_charge_refundable: false,
        livemode: false,
        metadata: {},
      },
    },
  };
}

async function deliver(event: ReturnType<typeof buildEvent>) {
  const payload = JSON.stringify(event);
  const signature = signStripeWebhook(payload, secret!);
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  const body = await r.text();
  console.log(`[${r.status}] ${event.type} → ${body}`);
  if (!r.ok) throw new Error(`webhook ${r.status}: ${body}`);
}

const fundsEvent =
  outcome === "won"
    ? "charge.dispute.funds_reinstated"
    : "charge.dispute.funds_withdrawn";

await deliver(buildEvent("charge.dispute.closed", outcome));
await deliver(buildEvent(fundsEvent, outcome));

console.log(`\n✓ Local dispute ${disputeId} → ${outcome}`);
console.log(
  "Note: Stripe's dispute record is unchanged. Dashboard still shows under_review.",
);
