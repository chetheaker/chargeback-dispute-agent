import { stripe } from "../stripe/client.ts";
import { trace } from "../trace.ts";
import type { AgentResult, StripeEvidence } from "../types.ts";

export async function submitDispute(
  result: AgentResult,
  opts: { submit?: boolean } = {},
) {
  const submit = opts.submit ?? false;
  await trace(result.disputeId, "submit.prepare", {
    submit,
    textFields: Object.keys(result.evidenceText),
    fileFields: Object.keys(result.evidenceFileContent),
  });

  const fileIds: Record<string, string> = {};
  for (const [field, content] of Object.entries(result.evidenceFileContent)) {
    if (!content) continue;
    try {
      const uploaded = await stripe.files.create({
        purpose: "dispute_evidence",
        file: {
          data: Buffer.from(content),
          name: `${field}.txt`,
          type: "text/plain",
        },
      });
      fileIds[field] = uploaded.id;
      await trace(result.disputeId, "submit.file_uploaded", {
        field,
        fileId: uploaded.id,
        size: content.length,
      });
    } catch (err) {
      await trace(result.disputeId, "submit.file_upload_error", {
        field,
        error: String(err),
      });
      throw err;
    }
  }

  const evidence: StripeEvidence = {
    ...result.evidenceText,
    ...fileIds,
  };

  try {
    const updated = await stripe.disputes.update(result.disputeId, {
      evidence: evidence as Record<string, string>,
      submit,
      metadata: {
        agent_reason_code: result.reasonCode,
        agent_cited_count: String(result.citedEvidenceIds.length),
      },
    });
    await trace(result.disputeId, "submit.ok", {
      status: updated.status,
      submit,
      fields: Object.keys(evidence),
    });
    return updated;
  } catch (err) {
    await trace(result.disputeId, "submit.error", { error: String(err) });
    throw err;
  }
}
