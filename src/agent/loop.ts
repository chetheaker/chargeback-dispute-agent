import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentResult,
  DisputeContext,
  EvidenceRecord,
  StripeEvidenceFiles,
  StripeEvidenceText,
} from "../types.ts";
import { trace } from "../trace.ts";
import { allTools, evidenceFetchers } from "./tools.ts";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_TURNS = 12;

const SYSTEM = `You are a chargeback dispute analyst for an online merchant. A customer (or their bank) has filed a chargeback against a charge. Your job is to gather evidence, classify the dispute reason, and draft a representment that argues the chargeback should be reversed.

Process:
1. Use the fetch_* tools to gather evidence. Call only what is relevant to the dispute reason — do not gather everything blindly. For "fraudulent" disputes, prioritize device, delivery, terms, history. For "product_not_received", prioritize order, comms, delivery. For "duplicate", prioritize order and history.
2. When you have enough evidence, call finalize_dispute exactly once.
3. The narrative must cite evidence by its record ID (e.g., [ev_delivery_1Z999...]). Every factual claim must trace to a specific record.
4. Stripe evidence dict: pick fields that match the reason code. Pack the narrative into uncategorized_text. Fill structured fields (shipping_carrier, shipping_tracking_number, customer_purchase_ip, etc.) where you have data — do not invent values.

Be concise. Be factual. The reviewer is a card-network analyst with limited time.`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runAgent(ctx: DisputeContext): Promise<AgentResult> {
  await trace(ctx.disputeId, "agent.start", {
    reason: ctx.reason,
    amount: ctx.amount,
    currency: ctx.currency,
  });

  const evidenceById = new Map<string, EvidenceRecord>();
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            `Dispute received from Stripe.\n\n` +
            `dispute_id: ${ctx.disputeId}\n` +
            `charge_id: ${ctx.chargeId}\n` +
            `amount: ${ctx.amount} ${ctx.currency}\n` +
            `stripe_reason: ${ctx.reason}\n` +
            `customer_email: ${ctx.customerEmail ?? "unknown"}\n` +
            `customer_id: ${ctx.customerId ?? "unknown"}\n\n` +
            `Investigate and finalize.`,
        },
      ],
    },
  ];

  type Finalized = {
    reason_code: string;
    narrative: string;
    cited_evidence_ids: string[];
    evidence_text: StripeEvidenceText;
    evidence_files: StripeEvidenceFiles;
  };
  let finalized: Finalized | null = null;

  for (let turn = 0; turn < MAX_TURNS && !finalized; turn++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: allTools,
      messages,
    });

    await trace(ctx.disputeId, "agent.turn", {
      turn,
      stop_reason: resp.stop_reason,
      blocks: resp.content.map((b) => b.type),
    });

    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason !== "tool_use") {
      await trace(ctx.disputeId, "agent.no_tool_call", {
        stop_reason: resp.stop_reason,
      });
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;
      await trace(ctx.disputeId, "agent.tool_use", {
        name: block.name,
        input: block.input,
      });

      if (block.name === "finalize_dispute") {
        finalized = block.input as Finalized;
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "Finalized.",
        });
        continue;
      }

      const fetcher = evidenceFetchers[block.name];
      if (!fetcher) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: `Unknown tool: ${block.name}`,
        });
        continue;
      }

      try {
        const record = await fetcher(ctx);
        evidenceById.set(record.id, record);
        await trace(ctx.disputeId, "agent.evidence", {
          id: record.id,
          kind: record.kind,
          summary: record.summary,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(
            { id: record.id, summary: record.summary, data: record.data },
            null,
            2,
          ),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: String(err),
        });
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }
  }

  if (!finalized) {
    throw new Error("Agent did not finalize within turn budget");
  }

  const result: AgentResult = {
    disputeId: ctx.disputeId,
    reasonCode: finalized.reason_code,
    narrative: finalized.narrative,
    evidenceText: finalized.evidence_text,
    evidenceFileContent: finalized.evidence_files,
    citedEvidenceIds: finalized.cited_evidence_ids,
    evidenceRecords: Array.from(evidenceById.values()),
  };

  await trace(ctx.disputeId, "agent.finalized", {
    reasonCode: result.reasonCode,
    citedCount: result.citedEvidenceIds.length,
    textFields: Object.keys(result.evidenceText),
    fileFields: Object.keys(result.evidenceFileContent),
  });

  return result;
}
