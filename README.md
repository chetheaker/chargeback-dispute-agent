# Chargeback Dispute Agent

Autonomous agent that receives a Stripe `charge.dispute.created` webhook, gathers evidence, drafts a representment, and submits the dispute back to Stripe.

## Stack

- Bun + Hono (TypeScript)
- Stripe SDK (test mode)
- Anthropic SDK (Claude tool use)

## Setup

```bash
bun install
cp .env.example .env
# fill in STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ANTHROPIC_API_KEY
```

Get the webhook secret from `stripe listen` output.

## Run (3 terminals)

```bash
# 1. server
bun run dev

# 2. forward Stripe webhooks to local server
bun run stripe:listen

# 3. trigger a test dispute
bun run stripe:trigger
```

Or trigger manually with a test card: charge `4000000000000259` (always disputed as fraudulent).

## Manual run for an existing dispute

```bash
curl -X POST http://localhost:3000/run/dp_test_abc123
# add ?submit=true to actually submit to Stripe
```

## Modes

- `AUTO_SUBMIT=false` (default) — agent runs and stores evidence on the dispute via `disputes.update`, but does not finalize. Safe for demo.
- `AUTO_SUBMIT=true` — agent submits the dispute (`submit: true`).

## Traces

Per-dispute JSONL trace at `traces/{disputeId}.jsonl`. Tail it during a demo:

```bash
tail -f traces/dp_*.jsonl
```

## Layout

```
src/
  index.ts          Hono app, webhook + manual-run endpoints
  agent/
    loop.ts         Tool-use loop: evidence gathering → finalize
    tools.ts        Tool schemas (6 evidence fetchers + finalize_dispute)
    submit.ts       stripe.disputes.update with evidence + submit flag
  evidence/         Mock evidence sources, one per kind
  stripe/           Stripe client + webhook verify
  trace.ts          JSONL tracer
  types.ts
```

## Adding a new evidence source

1. Add `src/evidence/foo.ts` exporting `fetchFoo(ctx) -> EvidenceRecord`.
2. Register it in `src/agent/tools.ts` (`evidenceFetchers` map + `evidenceTools` array).

## Notes for hackathon demo

- Stripe test mode does not run evidence through Visa/MC. Submission shows the bundle accepted by Stripe; no real adjudication.
- Reason codes use Stripe's enum (`fraudulent`, `product_not_received`, etc.), not raw network codes — Stripe abstracts the network layer.
- Prompt caching is enabled on the system prompt so repeated turns within a dispute are cheap.
