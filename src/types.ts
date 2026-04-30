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
  amount: number;
  currency: string;
  reason: string;
  customerEmail?: string;
  customerId?: string;
  createdAt: number;
}

export type StripeEvidenceField =
  | "billing_address"
  | "customer_communication"
  | "customer_email_address"
  | "customer_name"
  | "customer_purchase_ip"
  | "customer_signature"
  | "duplicate_charge_documentation"
  | "duplicate_charge_explanation"
  | "duplicate_charge_id"
  | "product_description"
  | "receipt"
  | "refund_policy"
  | "refund_policy_disclosure"
  | "refund_refusal_explanation"
  | "service_date"
  | "service_documentation"
  | "shipping_address"
  | "shipping_carrier"
  | "shipping_date"
  | "shipping_documentation"
  | "shipping_tracking_number"
  | "uncategorized_text"
  | "uncategorized_file";

export type StripeEvidence = Partial<Record<StripeEvidenceField, string>>;

export interface AgentResult {
  disputeId: string;
  reasonCode: string;
  narrative: string;
  evidence: StripeEvidence;
  citedEvidenceIds: string[];
  evidenceRecords: EvidenceRecord[];
}
