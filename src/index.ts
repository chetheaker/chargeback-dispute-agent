import { Hono } from "hono";
import type Stripe from "stripe";
import { verifyWebhook } from "./stripe/verify.ts";
import { stripe } from "./stripe/client.ts";
import { runAgent } from "./agent/loop.ts";
import { submitDispute } from "./agent/submit.ts";
import { trace } from "./trace.ts";
import type { DisputeContext } from "./types.ts";

const app = new Hono();
const PORT = Number(process.env.PORT ?? 3000);
const AUTO_SUBMIT = process.env.AUTO_SUBMIT === "true";

const inflight = new Map<string, Promise<unknown>>();

app.get("/", (c) => c.text("chargeback-dispute-agent up"));

app.post("/webhook", async (c) => {
  const sig = c.req.header("stripe-signature") ?? null;
  const raw = await c.req.text();

  let event: Stripe.Event;
  try {
    event = await verifyWebhook(raw, sig);
  } catch (err) {
    console.error("[webhook] signature verify failed:", err);
    return c.text("invalid signature", 400);
  }

  if (event.type !== "charge.dispute.created") {
    return c.json({ received: true, ignored: event.type });
  }

  const dispute = event.data.object as Stripe.Dispute;
  const ctx = toContext(dispute);

  if (inflight.has(ctx.disputeId)) {
    await trace(ctx.disputeId, "webhook.duplicate", {});
    return c.json({ received: true, status: "in_progress" });
  }

  const job = handleDispute(ctx).catch(async (err) => {
    await trace(ctx.disputeId, "pipeline.error", { error: String(err) });
    console.error("[pipeline]", err);
  });
  inflight.set(ctx.disputeId, job);
  job.finally(() => inflight.delete(ctx.disputeId));

  return c.json({ received: true, disputeId: ctx.disputeId });
});

app.post("/run/:disputeId", async (c) => {
  const id = c.req.param("disputeId");
  try {
    const dispute = await stripe.disputes.retrieve(id);
    const ctx = toContext(dispute);
    const result = await runAgent(ctx);
    const submitted = c.req.query("submit") === "true" || AUTO_SUBMIT;
    const stripeRes = await submitDispute(result, { submit: submitted });
    return c.json({
      disputeId: result.disputeId,
      reasonCode: result.reasonCode,
      narrative: result.narrative,
      citedEvidenceIds: result.citedEvidenceIds,
      stripeStatus: stripeRes.status,
      submitted,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

function toContext(d: Stripe.Dispute): DisputeContext {
  const charge = typeof d.charge === "string" ? d.charge : d.charge.id;
  return {
    disputeId: d.id,
    chargeId: charge,
    amount: d.amount,
    currency: d.currency,
    reason: d.reason,
    customerEmail:
      typeof d.charge === "string"
        ? undefined
        : (d.charge.billing_details?.email ?? undefined),
    customerId:
      typeof d.charge === "string"
        ? undefined
        : (typeof d.charge.customer === "string"
            ? d.charge.customer
            : (d.charge.customer?.id ?? undefined)),
    createdAt: d.created * 1000,
  };
}

async function handleDispute(ctx: DisputeContext) {
  await trace(ctx.disputeId, "pipeline.start", { reason: ctx.reason });
  const result = await runAgent(ctx);
  await submitDispute(result, { submit: AUTO_SUBMIT });
  await trace(ctx.disputeId, "pipeline.done", {
    submitted: AUTO_SUBMIT,
    reasonCode: result.reasonCode,
  });
}

console.log(`[server] listening on :${PORT}  AUTO_SUBMIT=${AUTO_SUBMIT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
