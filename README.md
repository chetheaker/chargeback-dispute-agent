# Chargebucks

Chargeback-dispute autopilot for indie devs on Stripe. Receives a `charge.dispute.created` webhook, runs an agent that gathers evidence, drafts a representment, and submits back to Stripe. Includes a live React UI for demoing the agent's work.

## Stack

- Backend: Bun + Hono (TypeScript), Stripe SDK, Anthropic SDK
- Frontend: Vite + React + TypeScript
- Live updates: Server-Sent Events tailing per-dispute JSONL trace

## Setup

```bash
bun install
cd web && bun install && cd ..
cp .env.example .env
# fill in STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ANTHROPIC_API_KEY
```

## Run for demo (4 terminals)

```bash
# 1. server + UI together (Hono :3000 + Vite :5173)
bun run dev:all

# 2. forward Stripe webhooks to local server
bun run stripe:listen
# copy the whsec_... it prints into .env, restart dev:all

# 3. open the UI
open http://localhost:5173
```

Click **+ New test dispute** in the UI sidebar — it shells out `stripe trigger charge.dispute.created`. Or trigger from your own terminal.

## Demo flow

1. Click **+ New test dispute** → Stripe creates a dispute, webhook fires, agent runs.
2. Watch the **Timeline** stream events live: `agent.tool_use` → `agent.evidence` → `agent.finalized` → `submit.file_uploaded` → `submit.ok`.
3. **Evidence cards** appear as the agent gathers them. Click to expand raw data.
4. **Verdict** panel shows the reason code badge and the narrative with `[ev_...]` citations as clickable links to the corresponding evidence card.
5. **Stripe submission** panel shows the final evidence dict (text fields + uploaded file references).
6. Click **Submit to Stripe** to finalize (only enabled when status is "ready").

## Modes

- `AUTO_SUBMIT=false` (default) — agent stages evidence on the dispute via `disputes.update`, but does not finalize. Submission is a manual click in the UI.
- `AUTO_SUBMIT=true` — pipeline auto-submits.

## Backend routes

- `POST /webhook` — Stripe webhook receiver (verifies signature)
- `GET /api/disputes` — list all known disputes
- `GET /api/disputes/:id` — single dispute record (context, agent result, status)
- `GET /events/:id` — SSE stream of trace events for a dispute
- `POST /api/disputes/:id/submit` — finalize via `disputes.update({submit: true})`
- `POST /api/disputes/:id/rerun` — re-run the agent on an existing dispute
- `POST /api/demo/trigger` — shells out `stripe trigger charge.dispute.created`

## Layout

```
src/
  index.ts          Hono app, webhook + API + SSE
  agent/
    loop.ts         Tool-use loop: evidence gathering → finalize
    tools.ts        Tool schemas (6 evidence fetchers + finalize_dispute)
    submit.ts       File uploads + stripe.disputes.update
  evidence/         Mock evidence sources, one per kind
  stripe/           Stripe client + webhook verify
  store.ts          Per-dispute record persistence (traces/<id>.record.json)
  sse.ts            Trace tail → SSE
  trace.ts          JSONL tracer
  types.ts
web/
  src/
    App.tsx
    components/
      Sidebar.tsx           Dispute list + trigger button
      DisputeHeader.tsx     ID, amount, reason, action buttons
      Timeline.tsx          Live trace stream
      EvidenceCards.tsx     Per-record cards with expand
      Verdict.tsx           Reason code + narrative with citations
      StripePayload.tsx     Final evidence preview
    useTraceStream.ts       SSE hook
    api.ts                  fetch helpers
scripts/
  dev.ts                    Spawns server + Vite together
```

## Adding a new evidence source

1. Add `src/evidence/foo.ts` exporting `fetchFoo(ctx) -> EvidenceRecord`.
2. Register it in `src/agent/tools.ts` (`evidenceFetchers` map + `evidenceTools` array).

## Notes

- Stripe test mode does not run evidence through Visa/MC. Submission shows the bundle accepted by Stripe; no real adjudication.
- File evidence fields (e.g. `customer_signature`, `shipping_documentation`) require Stripe file IDs. The agent emits text content; the submit step uploads each as `text/plain` via `stripe.files.create({purpose: 'dispute_evidence'})` and substitutes the IDs.
- Prompt caching is enabled on the system prompt so repeated turns within a dispute are cheap.
