import type { DisputeContext, EvidenceRecord } from "../types.ts";

export interface HistoryData {
  customerSince: string;
  totalOrders: number;
  totalSpend: number;
  currency: string;
  priorChargebacks: number;
  recentOrders: { orderId: string; placedAt: string; total: number }[];
}

export async function fetchHistory(
  ctx: DisputeContext,
): Promise<EvidenceRecord<HistoryData>> {
  const data: HistoryData = {
    customerSince: new Date(ctx.createdAt - 540 * 86400_000).toISOString(),
    totalOrders: 7,
    totalSpend: ctx.amount * 6,
    currency: ctx.currency,
    priorChargebacks: 0,
    recentOrders: [
      {
        orderId: "ord_aa11bb22",
        placedAt: new Date(ctx.createdAt - 90 * 86400_000).toISOString(),
        total: ctx.amount,
      },
      {
        orderId: "ord_cc33dd44",
        placedAt: new Date(ctx.createdAt - 30 * 86400_000).toISOString(),
        total: ctx.amount,
      },
    ],
  };
  return {
    id: `ev_history_${ctx.customerId ?? ctx.disputeId.slice(-8)}`,
    kind: "history",
    summary: `Customer since ${data.customerSince.slice(0, 10)}, ${data.totalOrders} prior orders, ${data.priorChargebacks} prior chargebacks.`,
    data,
  };
}
