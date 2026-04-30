import { stripe } from "../stripe/client.ts";
import { trace } from "../trace.ts";
import type { AgentResult } from "../types.ts";

export async function submitDispute(
  result: AgentResult,
  opts: { submit?: boolean } = {},
) {
  const submit = opts.submit ?? false;
  await trace(result.disputeId, "submit.prepare", {
    submit,
    fields: Object.keys(result.evidence),
  });

  try {
    const updated = await stripe.disputes.update(result.disputeId, {
      evidence: result.evidence as Record<string, string>,
      submit,
      metadata: {
        agent_reason_code: result.reasonCode,
        agent_cited_count: String(result.citedEvidenceIds.length),
      },
    });
    await trace(result.disputeId, "submit.ok", {
      status: updated.status,
      submit,
    });
    return updated;
  } catch (err) {
    await trace(result.disputeId, "submit.error", { error: String(err) });
    throw err;
  }
}
