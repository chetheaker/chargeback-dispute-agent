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
