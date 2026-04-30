import type { DisputeContext, EvidenceRecord } from "../types.ts";

export interface OrderData {
  orderId: string;
  placedAt: string;
  items: { sku: string; name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  billingAddress: {
    name: string;
    line1: string;
    city: string;
    postalCode: string;
    country: string;
  };
  shippingAddress: {
    name: string;
    line1: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export async function fetchOrder(
  ctx: DisputeContext,
): Promise<EvidenceRecord<OrderData>> {
  const data: OrderData = {
    orderId: `ord_${ctx.chargeId.slice(-8)}`,
    placedAt: new Date(ctx.createdAt - 5 * 86400_000).toISOString(),
    items: [
      { sku: "WIDGET-PRO", name: "Widget Pro", qty: 1, price: ctx.amount },
    ],
    subtotal: ctx.amount,
    tax: 0,
    total: ctx.amount,
    currency: ctx.currency,
    billingAddress: {
      name: "Jane Customer",
      line1: "742 Evergreen Terrace",
      city: "Springfield",
      postalCode: "49007",
      country: "US",
    },
    shippingAddress: {
      name: "Jane Customer",
      line1: "742 Evergreen Terrace",
      city: "Springfield",
      postalCode: "49007",
      country: "US",
    },
  };
  return {
    id: `ev_order_${data.orderId}`,
    kind: "order",
    summary: `Order ${data.orderId} placed ${data.placedAt} for ${data.total} ${data.currency}, billing matches shipping.`,
    data,
  };
}
