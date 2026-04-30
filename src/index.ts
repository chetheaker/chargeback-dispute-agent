import { Hono } from "hono";
import { cors } from "hono/cors";
import type Stripe from "stripe";
import { verifyWebhook } from "./stripe/verify.ts";
import { stripe } from "./stripe/client.ts";
import { runAgent } from "./agent/loop.ts";
import { submitDispute } from "./agent/submit.ts";
import { trace } from "./trace.ts";
import {
  listRecords,
  loadRecord,
  saveRecord,
  type DisputeRecord,
} from "./store.ts";
import { streamTrace } from "./sse.ts";
import { queries, resetDatabase } from "./db.ts";
import { seedIfEmpty } from "./seed.ts";
import { createScenario, type ScenarioReason } from "./scenarios.ts";
import { rm, readdir } from "node:fs/promises";
import type { DisputeContext } from "./types.ts";

const app = new Hono();
const PORT = Number(process.env.PORT ?? 3000);
const AUTO_SUBMIT = process.env.AUTO_SUBMIT === "true";

const seeded = seedIfEmpty();
if (seeded) console.log("[db] seeded products + customers");
console.log(
  `[db] products=${queries.listProducts.all().length} customers=${queries.listCustomers.all().length}`,
);

app.use("/api/*", cors());
app.use("/events/*", cors());

const inflight = new Map<string, Promise<unknown>>();

app.get("/", (c) => c.text("chargebucks up"));

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
  const ctx = await toContext(dispute);

  if (inflight.has(ctx.disputeId)) {
    await trace(ctx.disputeId, "webhook.duplicate", {});
    return c.json({ received: true, status: "in_progress" });
  }

  startPipeline(ctx);
  return c.json({ received: true, disputeId: ctx.disputeId });
});

app.get("/api/disputes", async (c) => {
  const recs = await listRecords();
  return c.json(
    recs.map((r) => ({
      disputeId: r.context.disputeId,
      amount: r.context.amount,
      currency: r.context.currency,
      reason: r.context.reason,
      status: r.status,
      stripeStatus: r.stripeStatus,
      reasonCode: r.result?.reasonCode,
      updatedAt: r.updatedAt,
    })),
  );
});

app.get("/api/disputes/:id", async (c) => {
  const rec = await loadRecord(c.req.param("id"));
  if (!rec) return c.json({ error: "not found" }, 404);
  return c.json(rec);
});

app.get("/events/:id", (c) => {
  return streamTrace(c.req.param("id"));
});

app.post("/api/disputes/:id/submit", async (c) => {
  const id = c.req.param("id");
  const rec = await loadRecord(id);
  if (!rec || !rec.result) {
    return c.json({ error: "no agent result staged for this dispute" }, 400);
  }
  try {
    const updated = await submitDispute(rec.result, { submit: true });
    rec.status = "submitted";
    rec.stripeStatus = updated.status;
    await saveRecord(rec);
    return c.json({ ok: true, status: updated.status });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/api/disputes/:id/rerun", async (c) => {
  const id = c.req.param("id");
  try {
    const dispute = await stripe.disputes.retrieve(id);
    const ctx = await toContext(dispute);
    if (inflight.has(ctx.disputeId)) {
      return c.json({ ok: true, status: "in_progress" });
    }
    startPipeline(ctx);
    return c.json({ ok: true, disputeId: ctx.disputeId });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.get("/api/products", (c) => {
  const products = queries.listProducts.all();
  return c.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceMinor: p.price_minor,
      currency: p.currency,
      category: p.category,
      sku: p.sku,
    })),
  );
});

app.get("/api/customers", (c) => {
  const customers = queries.listCustomers.all();
  return c.json(
    customers.map((cust) => ({
      id: cust.id,
      name: cust.name,
      email: cust.email,
      city: cust.address_city,
      country: cust.address_country,
    })),
  );
});

app.post("/api/db/reset", async (c) => {
  try {
    resetDatabase();
    seedIfEmpty();
    // wipe trace + record files
    try {
      const entries = await readdir("traces");
      await Promise.all(
        entries
          .filter(
            (e) => e.endsWith(".jsonl") || e.endsWith(".record.json"),
          )
          .map((e) => rm(`traces/${e}`, { force: true })),
      );
    } catch {}
    inflight.clear();
    return c.json({
      ok: true,
      products: queries.listProducts.all().length,
      customers: queries.listCustomers.all().length,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/api/scenarios", async (c) => {
  try {
    const body = (await c.req.json()) as {
      productId: string;
      reason: ScenarioReason;
      customerId?: string;
    };
    const result = await createScenario(body);
    return c.json(result);
  } catch (err) {
    console.error("[scenario]", err);
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/api/demo/trigger", async (c) => {
  try {
    const proc = Bun.spawn(
      ["stripe", "trigger", "charge.dispute.created"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    const code = await proc.exited;
    return c.json({ ok: code === 0, stdout: out, stderr: err });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

async function toContext(d: Stripe.Dispute): Promise<DisputeContext> {
  const chargeId = typeof d.charge === "string" ? d.charge : d.charge.id;

  let internalOrderId: string | undefined;
  let internalCustomerId: string | undefined;
  let customerEmail: string | undefined;
  let stripeCustomerId: string | undefined;
  let paymentIntentId: string | undefined;

  if (typeof d.charge !== "string") {
    customerEmail = d.charge.billing_details?.email ?? undefined;
    stripeCustomerId =
      typeof d.charge.customer === "string"
        ? d.charge.customer
        : (d.charge.customer?.id ?? undefined);
    paymentIntentId =
      typeof d.charge.payment_intent === "string"
        ? d.charge.payment_intent
        : (d.charge.payment_intent?.id ?? undefined);
    internalOrderId = d.charge.metadata?.internal_order_id;
    internalCustomerId = d.charge.metadata?.internal_customer_id;
  }

  // The webhook payload may not have charge expanded — and metadata typically
  // lives on the PaymentIntent we created, not the Charge. Retrieve PI to read.
  if (!internalOrderId) {
    try {
      if (!paymentIntentId) {
        const ch = await stripe.charges.retrieve(chargeId);
        paymentIntentId =
          typeof ch.payment_intent === "string"
            ? ch.payment_intent
            : (ch.payment_intent?.id ?? undefined);
        customerEmail = customerEmail ?? ch.billing_details?.email ?? undefined;
        stripeCustomerId =
          stripeCustomerId ??
          (typeof ch.customer === "string"
            ? ch.customer
            : (ch.customer?.id ?? undefined));
        if (ch.metadata?.internal_order_id) {
          internalOrderId = ch.metadata.internal_order_id;
          internalCustomerId = ch.metadata.internal_customer_id;
        }
      }
      if (paymentIntentId && !internalOrderId) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        internalOrderId = pi.metadata?.internal_order_id;
        internalCustomerId = pi.metadata?.internal_customer_id;
        customerEmail = customerEmail ?? pi.receipt_email ?? undefined;
        stripeCustomerId =
          stripeCustomerId ??
          (typeof pi.customer === "string"
            ? pi.customer
            : (pi.customer?.id ?? undefined));
      }
    } catch (err) {
      console.warn("[webhook] could not enrich dispute metadata:", err);
    }
  }

  return {
    disputeId: d.id,
    chargeId,
    paymentIntentId,
    amount: d.amount,
    currency: d.currency,
    reason: d.reason,
    customerEmail,
    customerId: stripeCustomerId,
    internalOrderId,
    internalCustomerId,
    createdAt: d.created * 1000,
  };
}

function startPipeline(ctx: DisputeContext) {
  const job = handleDispute(ctx).catch(async (err) => {
    await trace(ctx.disputeId, "pipeline.error", { error: String(err) });
    console.error("[pipeline]", err);
    const rec = (await loadRecord(ctx.disputeId)) ?? blankRecord(ctx);
    rec.status = "error";
    rec.error = String(err);
    await saveRecord(rec);
  });
  inflight.set(ctx.disputeId, job);
  job.finally(() => inflight.delete(ctx.disputeId));
  return job;
}

function blankRecord(ctx: DisputeContext): DisputeRecord {
  return { context: ctx, status: "pending", updatedAt: Date.now() };
}

async function handleDispute(ctx: DisputeContext) {
  await trace(ctx.disputeId, "pipeline.start", { reason: ctx.reason });

  let rec = (await loadRecord(ctx.disputeId)) ?? blankRecord(ctx);
  rec.context = ctx;
  rec.status = "running";
  await saveRecord(rec);

  const result = await runAgent(ctx);
  rec.result = result;
  rec.status = "ready";
  await saveRecord(rec);

  const stripeRes = await submitDispute(result, { submit: AUTO_SUBMIT });
  rec.stripeStatus = stripeRes.status;
  rec.status = AUTO_SUBMIT ? "submitted" : "ready";
  await saveRecord(rec);

  await trace(ctx.disputeId, "pipeline.done", {
    submitted: AUTO_SUBMIT,
    reasonCode: result.reasonCode,
    stripeStatus: stripeRes.status,
  });
}

console.log(`[server] listening on :${PORT}  AUTO_SUBMIT=${AUTO_SUBMIT}`);

export default {
  port: PORT,
  idleTimeout: 0,
  fetch: app.fetch,
};
