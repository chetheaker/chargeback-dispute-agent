import type { DisputeContext, EvidenceRecord } from "../types.ts";
import { formatAmount, toMajorUnits } from "../format.ts";
import { queries } from "../db.ts";

export interface OrderData {
  orderId: string;
  placedAt: string;
  product?: { id: string; name: string; sku: string; category: string; description: string };
  items: { sku: string; name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  billingAddress: AddressBlock;
  shippingAddress: AddressBlock;
  source: "db" | "mock";
}

interface AddressBlock {
  name: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
}

export async function fetchOrder(
  ctx: DisputeContext,
): Promise<EvidenceRecord<OrderData>> {
  if (ctx.internalOrderId) {
    const order = queries.getOrder.get(ctx.internalOrderId);
    if (order) {
      const product = queries.getProduct.get(order.product_id) ?? undefined;
      const customer = queries.getCustomer.get(order.customer_id);
      const total = toMajorUnits(order.total_minor, order.currency);
      const data: OrderData = {
        orderId: order.id,
        placedAt: new Date(order.placed_at).toISOString(),
        product: product
          ? {
              id: product.id,
              name: product.name,
              sku: product.sku,
              category: product.category,
              description: product.description,
            }
          : undefined,
        items: [
          {
            sku: product?.sku ?? "UNKNOWN",
            name: product?.name ?? "Unknown product",
            qty: 1,
            price: total,
          },
        ],
        subtotal: total,
        tax: 0,
        total,
        currency: order.currency,
        billingAddress: {
          name: customer?.name ?? "",
          line1: order.billing_line1,
          city: order.billing_city,
          postalCode: order.billing_postal_code,
          country: order.billing_country,
        },
        shippingAddress: {
          name: customer?.name ?? "",
          line1: order.shipping_line1,
          city: order.shipping_city,
          postalCode: order.shipping_postal_code,
          country: order.shipping_country,
        },
        source: "db",
      };
      return {
        id: `ev_order_${order.id}`,
        kind: "order",
        summary: `Order ${order.id} for ${product?.name ?? "product"} (${product?.sku ?? "?"}) placed ${data.placedAt} for ${formatAmount(order.total_minor, order.currency)}; billing matches shipping.`,
        data,
      };
    }
  }
  return mockOrder(ctx);
}

function mockOrder(ctx: DisputeContext): EvidenceRecord<OrderData> {
  const total = toMajorUnits(ctx.amount, ctx.currency);
  const data: OrderData = {
    orderId: `ord_${ctx.chargeId.slice(-8)}`,
    placedAt: new Date(ctx.createdAt - 5 * 86400_000).toISOString(),
    items: [{ sku: "WIDGET-PRO", name: "Widget Pro", qty: 1, price: total }],
    subtotal: total,
    tax: 0,
    total,
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
    source: "mock",
  };
  return {
    id: `ev_order_${data.orderId}`,
    kind: "order",
    summary: `Order ${data.orderId} placed ${data.placedAt} for ${formatAmount(ctx.amount, ctx.currency)}, billing matches shipping. (mock — no internal_order_id on dispute)`,
    data,
  };
}

