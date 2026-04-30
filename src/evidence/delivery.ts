import type { DisputeContext, EvidenceRecord } from "../types.ts";

export interface DeliveryData {
  carrier: string;
  trackingNumber: string;
  shippedAt: string;
  deliveredAt: string;
  deliveryAddress: string;
  signedBy?: string;
  proofUrl: string;
}

export async function fetchDelivery(
  ctx: DisputeContext,
): Promise<EvidenceRecord<DeliveryData>> {
  const t0 = ctx.createdAt - 5 * 86400_000;
  const data: DeliveryData = {
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    shippedAt: new Date(t0 + 2 * 86400_000).toISOString(),
    deliveredAt: new Date(t0 + 4 * 86400_000).toISOString(),
    deliveryAddress: "742 Evergreen Terrace, Springfield, 49007, US",
    signedBy: "J. CUSTOMER",
    proofUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
  };
  return {
    id: `ev_delivery_${data.trackingNumber}`,
    kind: "delivery",
    summary: `${data.carrier} ${data.trackingNumber} delivered ${data.deliveredAt}, signed by ${data.signedBy}.`,
    data,
  };
}
