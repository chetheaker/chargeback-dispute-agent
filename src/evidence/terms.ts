import type { DisputeContext, EvidenceRecord } from "../types.ts";
import { queries } from "../db.ts";

export interface TermsData {
  acceptedAt: string;
  acceptedFromIp: string;
  termsVersion: string;
  termsUrl: string;
  refundPolicy: string;
  refundPolicyUrl: string;
  checkboxText: string;
  source: "db" | "mock";
}

export async function fetchTerms(
  ctx: DisputeContext,
): Promise<EvidenceRecord<TermsData>> {
  if (ctx.internalOrderId) {
    const row = queries.termsForOrder.get(ctx.internalOrderId);
    if (row) {
      const data: TermsData = {
        acceptedAt: new Date(row.accepted_at).toISOString(),
        acceptedFromIp: row.accepted_from_ip,
        termsVersion: row.terms_version,
        termsUrl: row.terms_url,
        refundPolicy: row.refund_policy,
        refundPolicyUrl: row.refund_policy_url,
        checkboxText: row.checkbox_text,
        source: "db",
      };
      return {
        id: `ev_terms_${row.terms_version}_${row.order_id}`,
        kind: "terms",
        summary: `Customer accepted T&Cs v${row.terms_version} on ${data.acceptedAt} from IP ${row.accepted_from_ip}.`,
        data,
      };
    }
  }
  return mockTerms(ctx);
}

function mockTerms(ctx: DisputeContext): EvidenceRecord<TermsData> {
  const data: TermsData = {
    acceptedAt: new Date(ctx.createdAt - 5 * 86400_000).toISOString(),
    acceptedFromIp: "73.221.18.42",
    termsVersion: "2025-09-01",
    termsUrl: "https://example.com/terms",
    refundPolicy:
      "All sales final after 14 days. Refunds available within 14 days of delivery for unopened items.",
    refundPolicyUrl: "https://example.com/refunds",
    checkboxText: "I agree to the Terms of Service and Refund Policy.",
    source: "mock",
  };
  return {
    id: `ev_terms_${data.termsVersion}`,
    kind: "terms",
    summary: `Customer accepted T&Cs v${data.termsVersion} on ${data.acceptedAt} from IP ${data.acceptedFromIp}. (mock)`,
    data,
  };
}
