export interface DisputeContext {
  disputeId: string;
  chargeId: string;
  paymentIntentId?: string;
  amount: number;
  currency: string;
  reason: string;
  customerEmail?: string;
  customerId?: string;
  internalOrderId?: string;
  internalCustomerId?: string;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  category: "physical" | "digital" | "subscription";
  sku: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  city: string;
  country: string;
}

export type ScenarioReason = "fraudulent" | "product_not_received" | "unrecognized";

export interface CreateScenarioRequest {
  productId: string;
  reason: ScenarioReason;
  customerId?: string;
}

export interface CreateScenarioResponse {
  orderId: string;
  customerId: string;
  paymentIntentId: string;
  chargeId: string | null;
  status: string;
}

export interface EvidenceRecord {
  id: string;
  kind: string;
  summary: string;
  data: unknown;
}

export interface AgentResult {
  disputeId: string;
  reasonCode: string;
  narrative: string;
  evidenceText: Record<string, string>;
  evidenceFileContent: Record<string, string>;
  citedEvidenceIds: string[];
  evidenceRecords: EvidenceRecord[];
}

export interface DisputeRecord {
  context: DisputeContext;
  result?: AgentResult;
  status: "pending" | "running" | "ready" | "submitted" | "error";
  stripeStatus?: string;
  error?: string;
  updatedAt: number;
}

export interface DisputeSummary {
  disputeId: string;
  amount: number;
  currency: string;
  reason: string;
  status: DisputeRecord["status"];
  stripeStatus?: string;
  reasonCode?: string;
  updatedAt: number;
}

export interface TraceEvent {
  ts: number;
  disputeId: string;
  type: string;
  data?: any;
}
