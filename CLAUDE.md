# CLAUDE.md

Guidance for Claude Code / Cursor agents working in this repo.

## Project: Chargebucks

Hackathon project. **Chargebucks** is a chargeback-dispute autopilot for indie devs on Stripe. It receives a `charge.dispute.created` webhook, runs an Anthropic tool-use agent that gathers evidence from a fixed set of mock sources, classifies the dispute, drafts a representment narrative with inline evidence citations, packs the result into Stripe's `evidence` schema (text fields + uploaded PDF files), and either stages or submits via `disputes.update`.

A live React UI streams the agent's trace over SSE so the demo isn't a black box.

> The product/brand name is **Chargebucks**. The git repo is still named `chargeback-dispute-agent` — leave it that way unless explicitly asked to rename.

## Stack

- Runtime: Bun (TypeScript everywhere, `.ts` imports with explicit extensions)
- Backend: Hono on `:3000`
- LLM: Anthropic SDK, default model `claude-sonnet-4-6` (override with `ANTHROPIC_MODEL`). Prompt caching enabled on the system prompt.
- Stripe SDK pinned to API version `2024-09-30.acacia`
- Frontend: Vite + React 18 on `:5173`, proxies `/api` and `/events` to backend
- Live updates: per-dispute JSONL trace tailed → SSE
- PDF generation: `pdf-lib` (file evidence is rendered to PDF before upload)

## Commands

```bash
bun install
cd web && bun install && cd ..
cp .env.example .env  # fill in keys

bun run dev:all       # spawns backend + Vite together (scripts/dev.ts)
bun run dev           # backend only, hot reload
bun run dev:web       # vite only

bun run stripe:listen   # forwards Stripe events to /webhook (paste whsec_ into .env)
bun run stripe:trigger  # fires charge.dispute.created
bun run typecheck       # tsc --noEmit on both server and web
```

There is no test runner yet. There is no linter wired up. If you add either, update this file.

## Required env

```
STRIPE_SECRET_KEY        sk_test_...
STRIPE_WEBHOOK_SECRET    whsec_...   (from `stripe listen`)
ANTHROPIC_API_KEY        sk-ant-...
PORT                     default 3000
ANTHROPIC_MODEL          default claude-sonnet-4-6
AUTO_SUBMIT              "true" auto-finalizes; default "false" stages and waits for UI click
```

## End-to-end flow

1. **Webhook** (`POST /webhook`) — verifies Stripe signature, ignores anything that isn't `charge.dispute.created`, builds a `DisputeContext`, and starts the pipeline. Duplicate webhooks for an in-flight dispute are deduped via the `inflight` map in `src/index.ts`.
2. **Pipeline** (`handleDispute` in `src/index.ts`) — saves a `DisputeRecord` (`status: running`), runs the agent, then calls `submitDispute(...)` with `submit: AUTO_SUBMIT`.
3. **Agent loop** (`src/agent/loop.ts`) — Anthropic tool-use loop, max 12 turns. Tools are 6 `fetch_*` evidence fetchers + `finalize_dispute`. The agent decides which sources to call based on the Stripe reason. The system prompt biases choice (`fraudulent` → device/delivery/terms/history, `product_not_received` → order/comms/delivery, etc.). Loop ends when the model calls `finalize_dispute` or stops with no tool call.
4. **Submit** (`src/agent/submit.ts`) — for each `evidenceFileContent` field, render a one-page-or-more PDF (`src/agent/pdf.ts`), upload via `stripe.files.create({ purpose: "dispute_evidence" })`, and substitute the file IDs into the evidence dict alongside the text fields. Then `stripe.disputes.update(id, { evidence, submit, metadata })`.
5. **Trace** — every meaningful step writes a JSONL line to `traces/<disputeId>.jsonl` (`src/trace.ts`). The SSE endpoint tails that file and streams events to the UI (`src/sse.ts`, hybrid `fs.watch` + 500ms poll fallback). Per-dispute state lives at `traces/<disputeId>.record.json`.

## Layout

```
src/
  index.ts            Hono app: webhook, /api/*, /events/*, pipeline orchestration
  trace.ts            JSONL tracer (append-only)
  sse.ts              Trace tail → SSE
  store.ts            DisputeRecord persistence (traces/<id>.record.json)
  types.ts            DisputeContext, EvidenceRecord, AgentResult, Stripe field unions
  stripe/
    client.ts         Stripe client (apiVersion 2024-09-30.acacia)
    verify.ts         constructEventAsync wrapper
  agent/
    loop.ts           Anthropic tool-use loop with prompt caching
    tools.ts          Tool schemas + evidenceFetchers map
    submit.ts         File upload (PDF) + disputes.update
    pdf.ts            pdf-lib text-to-PDF (Latin-1 only, naive word-wrap)
  evidence/           One file per source: orders, comms, device, delivery, history, terms
                      Each exports fetchX(ctx) -> EvidenceRecord with stable id (record IDs are
                      cited by the narrative; do not generate them per-call differently)
web/
  src/
    App.tsx                      Polls /api/disputes, opens SSE on selection
    api.ts                       fetch helpers (relative paths, proxied by vite)
    useTraceStream.ts            EventSource hook
    components/
      Sidebar.tsx                Dispute list + "+ New test dispute" → POST /api/demo/trigger
      DisputeHeader.tsx          ID, amount, reason, Re-run / Submit buttons
      Timeline.tsx               Live event list with icon/summary per event type
      EvidenceCards.tsx          Expandable per-record cards (anchored to id="ev-<id>" for citation links)
      Verdict.tsx                Reason code + narrative; [ev_...] tokens become anchor links
      StripePayload.tsx          Final evidence dict preview
  vite.config.ts                 Proxies /api and /events → :3000
scripts/
  dev.ts                         Spawns server + vite with prefixed log streams
traces/                          Generated at runtime; gitignored
```

## HTTP routes

- `POST /webhook` — Stripe receiver; verifies signature.
- `GET  /api/disputes` — list of summaries (id, amount, reason, status, ...).
- `GET  /api/disputes/:id` — full `DisputeRecord` including `result`.
- `GET  /events/:id` — SSE stream of trace events.
- `POST /api/disputes/:id/submit` — finalize via `disputes.update({ submit: true })`.
- `POST /api/disputes/:id/rerun` — re-fetch dispute from Stripe and re-run the agent.
- `POST /api/demo/trigger` — shells out `stripe trigger charge.dispute.created` (Stripe CLI must be installed).

## Conventions to preserve

- **Evidence record IDs are stable and content-derived.** `ev_order_<orderId>`, `ev_delivery_<tracking>`, `ev_terms_<version>`, etc. The narrative cites them; if you change ID generation, citations break in the UI's anchor links.
- **One file per evidence source.** Mock data lives next to the fetcher. To add a source: create `src/evidence/<x>.ts` exporting `fetchX(ctx) -> EvidenceRecord`, then register it in `evidenceFetchers` and `evidenceTools` in `src/agent/tools.ts`. Add a kind icon in `web/src/components/EvidenceCards.tsx` if you want a glyph.
- **Stripe evidence fields are typed.** See `StripeEvidenceTextField` and `StripeEvidenceFileField` unions in `src/types.ts`. The agent emits the file fields as plain text; `submit.ts` renders each to PDF and uploads.
- **Trace events are typed by string.** Frontend (`Timeline.tsx`) and backend agree on type strings (`agent.tool_use`, `agent.evidence`, `agent.finalized`, `submit.file_uploaded`, `submit.ok`, etc.). Add new event types in both places.
- **No fixed tool sequence.** Don't hardcode evidence-gathering order — the agent picks. The system prompt nudges priority by reason code, that's it.
- **Network-agnostic for now.** The agent emits a Stripe-shaped evidence dict directly. Visa CE 3.0 / Mastercard Compelling Evidence adapter layer is not built; if it is, keep classification/narrative network-agnostic and translate at format time.
- **Latin-1 only in file evidence.** `pdf.ts` sanitizes non-ASCII to `?` because `pdf-lib` Standard fonts can't encode it. If you need Unicode, embed a TTF.

## Open / unfinished

- No real test suite. `bun run typecheck` is the only check.
- `evidenceText` and `evidenceFileContent` are currently passed to Stripe as-is — no validation that the agent only used legal field names. The TS unions describe what's allowed but the model output isn't schema-validated at runtime.
- Stripe test mode does not actually run evidence through Visa/MC. The "Submitted" status is Stripe-side only.
