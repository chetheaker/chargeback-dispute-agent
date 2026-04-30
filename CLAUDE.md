# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

Hackathon project: **Chargeback Dispute Agent**. Autonomous agent that ingests a chargeback notification (mock Stripe webhook), gathers evidence, classifies the dispute code, drafts a representment narrative, formats it to card-network specs, and submits.

This is a greenfield repository — no code has been written yet. Decisions made during the first build pass will define the structure; revisit this file once an initial scaffold lands.

## End-to-end flow the code must implement

1. **Webhook intake** — accept a mock Stripe `charge.dispute.created` payload.
2. **Evidence gathering (agent loop)** — pull order details, customer comms history, IP/device fingerprint, delivery confirmation, prior order history, accepted T&Cs. Each source should be a distinct tool/function the agent calls so missing data is visible in traces.
3. **Reason-code classification** — map dispute to a card-network reason code (Visa / Mastercard schemes differ — keep classifier output network-agnostic, then translate at format time).
4. **Representment narrative** — LLM drafts the argument citing specific evidence items by ID. Narrative must be auditable: every claim should reference a gathered evidence record.
5. **Network-specific assembly** — format evidence bundle to the target network's submission spec (Visa CE 3.0 / Mastercard Compelling Evidence).
6. **Submit** — mock submission endpoint for the demo; real Stripe `dispute.update` call is a stretch goal.

## Architectural guidance for the first pass

- **Keep evidence sources behind a uniform interface.** Each source (orders, comms, device, delivery, history, T&Cs) should expose `fetch(dispute_context) -> EvidenceRecord`. The agent decides which to call; do not hard-code a fixed sequence — that defeats the "autonomous" point.
- **Separate "what to argue" from "how to format".** Classification + narrative generation are network-agnostic. Network-specific spec assembly is a final adapter layer. Mixing these will hurt later when a second network is added.
- **Evidence records need stable IDs.** The narrative cites them; the assembled bundle attaches them. If IDs are generated per-call, citations break.
- **Mock data lives next to the tool that returns it.** A single `fixtures/` blob will become unmaintainable; co-locate per-source mocks with the source module.
- **Trace the agent loop.** For demo purposes, capture each tool call + reasoning step. A simple JSONL trace is enough; this is what makes the demo compelling vs. a black box.

## Stack — undecided

No language/framework chosen yet. Likely candidates given the brief: Python (Anthropic SDK, fast for agent loops) or TypeScript (matches Stripe ecosystem). Pick one in the first commit and update this file with run/test/lint commands at that point.

When AI framework choice comes up, default to the latest Claude models (Opus 4.7 / Sonnet 4.6) and enable prompt caching — the evidence-gathering loop will repeatedly send the same dispute context, so caching is high-leverage.

## What to update here once code exists

- Build / dev / test / lint commands (including how to run a single test).
- Where the agent loop lives and how to invoke a dispute end-to-end locally.
- How to add a new evidence source or a new card network adapter.
- Any environment variables required (Stripe test key, Anthropic key, etc.).
