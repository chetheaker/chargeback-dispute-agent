export type EvidenceKind =
  | "order"
  | "comms"
  | "device"
  | "delivery"
  | "history"
  | "terms";

export interface EvidenceRecord<T = unknown> {
  id: string;
  kind: EvidenceKind;
  summary: string;
  data: T;
  attachments?: { filename: string; mime: string; bytes: Uint8Array }[];
}

export interface DisputeContext {
  disputeId: string;
  chargeId: string;
  paymentIntentId?: string;
  amount: number;
  currency: string;
  reason: string;
  customerEmail?: string;
  customerId?: string;
  /** Internal IDs from PaymentIntent metadata (set when scenario was created via /api/scenarios). */
  internalOrderId?: string;
  internalCustomerId?: string;
  createdAt: number;
}

export type StripeEvidenceTextField =
  | "access_activity_log"
  | "billing_address"
  | "cancellation_policy_disclosure"
  | "cancellation_rebuttal"
  | "customer_email_address"
  | "customer_name"
  | "customer_purchase_ip"
  | "duplicate_charge_explanation"
  | "duplicate_charge_id"
  | "product_description"
  | "refund_policy_disclosure"
  | "refund_refusal_explanation"
  | "service_date"
  | "shipping_address"
  | "shipping_carrier"
  | "shipping_date"
  | "shipping_tracking_number"
  | "uncategorized_text";

export type StripeEvidenceFileField =
  | "cancellation_policy"
  | "customer_communication"
  | "customer_signature"
  | "duplicate_charge_documentation"
  | "receipt"
  | "refund_policy"
  | "service_documentation"
  | "shipping_documentation"
  | "uncategorized_file";

export type StripeEvidenceText = Partial<Record<StripeEvidenceTextField, string>>;
export type StripeEvidenceFiles = Partial<Record<StripeEvidenceFileField, string>>;
export type StripeEvidence = Partial<
  Record<StripeEvidenceTextField | StripeEvidenceFileField, string>
>;

export interface AgentResult {
  disputeId: string;
  reasonCode: string;
  narrative: string;
  evidenceText: StripeEvidenceText;
  evidenceFileContent: StripeEvidenceFiles;
  citedEvidenceIds: string[];
  evidenceRecords: EvidenceRecord[];
}
