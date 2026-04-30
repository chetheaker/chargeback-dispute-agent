import type { DisputeContext, EvidenceRecord } from "../types.ts";

export interface TermsData {
  acceptedAt: string;
  acceptedFromIp: string;
  termsVersion: string;
  termsUrl: string;
  refundPolicy: string;
  refundPolicyUrl: string;
  checkboxText: string;
}

export async function fetchTerms(
  ctx: DisputeContext,
): Promise<EvidenceRecord<TermsData>> {
  const data: TermsData = {
    acceptedAt: new Date(ctx.createdAt - 5 * 86400_000).toISOString(),
    acceptedFromIp: "73.221.18.42",
    termsVersion: "2025-09-01",
    termsUrl: "https://example.com/terms",
    refundPolicy:
      "All sales final after 14 days. Refunds available within 14 days of delivery for unopened items.",
    refundPolicyUrl: "https://example.com/refunds",
    checkboxText:
      "I agree to the Terms of Service and Refund Policy.",
  };
  return {
    id: `ev_terms_${data.termsVersion}`,
    kind: "terms",
    summary: `Customer accepted T&Cs v${data.termsVersion} on ${data.acceptedAt} from IP ${data.acceptedFromIp}.`,
    data,
  };
}
