import type { DisputeContext, EvidenceRecord } from "../types.ts";
import { queries } from "../db.ts";

export interface DeliveryData {
  carrier: string;
  trackingNumber: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  deliveryAddress: string;
  signedBy?: string | null;
  proofUrl?: string | null;
  source: "db" | "mock" | "none";
}

export async function fetchDelivery(
  ctx: DisputeContext,
): Promise<EvidenceRecord<DeliveryData>> {
  if (ctx.internalOrderId) {
    const shipments = queries.shipmentsForOrder.all(ctx.internalOrderId);
    const order = queries.getOrder.get(ctx.internalOrderId);
    const product = order ? queries.getProduct.get(order.product_id) : null;

    if (shipments.length === 0) {
      // No physical shipment — digital/subscription product. Be honest.
      const data: DeliveryData = {
        carrier: "n/a",
        trackingNumber: "n/a",
        shippedAt: null,
        deliveredAt: null,
        deliveryAddress: "n/a (digital fulfilment)",
        source: "none",
      };
      return {
        id: `ev_delivery_${ctx.internalOrderId}`,
        kind: "delivery",
        summary: product
          ? `No physical shipment — ${product.name} is a ${product.category} product, fulfilled electronically.`
          : "No physical shipment for this order (digital fulfilment).",
        data,
      };
    }

    const s = shipments[0]!;
    const data: DeliveryData = {
      carrier: s.carrier,
      trackingNumber: s.tracking_number,
      shippedAt: s.shipped_at ? new Date(s.shipped_at).toISOString() : null,
      deliveredAt: s.delivered_at ? new Date(s.delivered_at).toISOString() : null,
      deliveryAddress: s.delivery_address,
      signedBy: s.signed_by,
      proofUrl: s.proof_url,
      source: "db",
    };
    return {
      id: `ev_delivery_${s.tracking_number}`,
      kind: "delivery",
      summary: s.delivered_at
        ? `${s.carrier} ${s.tracking_number} delivered ${data.deliveredAt}, signed by ${s.signed_by}.`
        : `${s.carrier} ${s.tracking_number} shipped ${data.shippedAt}; not yet delivered.`,
      data,
    };
  }
  return mockDelivery(ctx);
}

function mockDelivery(ctx: DisputeContext): EvidenceRecord<DeliveryData> {
  const t0 = ctx.createdAt - 5 * 86400_000;
  const data: DeliveryData = {
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    shippedAt: new Date(t0 + 2 * 86400_000).toISOString(),
    deliveredAt: new Date(t0 + 4 * 86400_000).toISOString(),
    deliveryAddress: "742 Evergreen Terrace, Springfield, 49007, US",
    signedBy: "J. CUSTOMER",
    proofUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    source: "mock",
  };
  return {
    id: `ev_delivery_${data.trackingNumber}`,
    kind: "delivery",
    summary: `${data.carrier} ${data.trackingNumber} delivered ${data.deliveredAt}, signed by ${data.signedBy}. (mock)`,
    data,
  };
}
