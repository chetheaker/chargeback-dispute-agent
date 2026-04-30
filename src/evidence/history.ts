import type { DisputeContext, EvidenceRecord } from "../types.ts";
import { formatAmount, toMajorUnits } from "../format.ts";
import { queries } from "../db.ts";

export interface HistoryData {
  customerSince: string;
  totalOrders: number;
  totalSpend: number;
  currency: string;
  priorChargebacks: number;
  recentOrders: { orderId: string; placedAt: string; total: number; productId?: string }[];
  source: "db" | "mock";
}

export async function fetchHistory(
  ctx: DisputeContext,
): Promise<EvidenceRecord<HistoryData>> {
  if (ctx.internalOrderId) {
    const order = queries.getOrder.get(ctx.internalOrderId);
    if (order) {
      const customer = queries.getCustomer.get(order.customer_id);
      const others = queries.ordersForCustomer.all(order.customer_id, order.id);
      const totalSpendMinor = others.reduce(
        (sum, o) => sum + o.total_minor,
        0,
      );
      const data: HistoryData = {
        customerSince: customer
          ? new Date(customer.created_at).toISOString()
          : "unknown",
        totalOrders: others.length,
        totalSpend: toMajorUnits(totalSpendMinor, order.currency),
        currency: order.currency,
        priorChargebacks: 0,
        recentOrders: others.slice(0, 5).map((o) => ({
          orderId: o.id,
          placedAt: new Date(o.placed_at).toISOString(),
          total: toMajorUnits(o.total_minor, o.currency),
          productId: o.product_id,
        })),
        source: "db",
      };
      return {
        id: `ev_history_${order.customer_id}`,
        kind: "history",
        summary: customer
          ? `Customer ${customer.name} (${customer.email}) since ${data.customerSince.slice(0, 10)}, ${data.totalOrders} prior orders totalling ${formatAmount(totalSpendMinor, order.currency)}, ${data.priorChargebacks} prior chargebacks.`
          : `${data.totalOrders} prior orders, no chargebacks.`,
        data,
      };
    }
  }
  return mockHistory(ctx);
}

function mockHistory(ctx: DisputeContext): EvidenceRecord<HistoryData> {
  const orderTotal = toMajorUnits(ctx.amount, ctx.currency);
  const data: HistoryData = {
    customerSince: new Date(ctx.createdAt - 540 * 86400_000).toISOString(),
    totalOrders: 7,
    totalSpend: orderTotal * 6,
    currency: ctx.currency,
    priorChargebacks: 0,
    recentOrders: [],
    source: "mock",
  };
  return {
    id: `ev_history_${ctx.customerId ?? ctx.disputeId.slice(-8)}`,
    kind: "history",
    summary: `Customer since ${data.customerSince.slice(0, 10)}, ${data.totalOrders} prior orders totalling ${formatAmount(ctx.amount * 6, ctx.currency)}, ${data.priorChargebacks} prior chargebacks. (mock)`,
    data,
  };
}
