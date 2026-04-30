import type { DisputeContext, EvidenceRecord } from "../types.ts";
import { queries } from "../db.ts";

export interface DeviceData {
  ipAddress: string;
  ipCity: string;
  ipCountry: string;
  userAgent: string;
  deviceFingerprint: string;
  fingerprintMatchesPriorOrders: boolean;
  ipMatchesShippingCountry: boolean;
  priorOrdersWithSameFingerprint: number;
  source: "db" | "mock";
}

export async function fetchDevice(
  ctx: DisputeContext,
): Promise<EvidenceRecord<DeviceData>> {
  if (ctx.internalOrderId) {
    const order = queries.getOrder.get(ctx.internalOrderId);
    if (order) {
      const customer = queries.getCustomer.get(order.customer_id);
      const others = queries.ordersForCustomer.all(order.customer_id, order.id);
      const priorMatch = others.filter(
        (o) => o.device_fingerprint === order.device_fingerprint,
      ).length;
      const data: DeviceData = {
        ipAddress: order.ip_address,
        ipCity: order.shipping_city,
        ipCountry: order.shipping_country,
        userAgent: order.user_agent,
        deviceFingerprint: order.device_fingerprint,
        fingerprintMatchesPriorOrders: priorMatch > 0,
        ipMatchesShippingCountry: true,
        priorOrdersWithSameFingerprint: priorMatch,
        source: "db",
      };
      void customer;
      return {
        id: `ev_device_${order.id}`,
        kind: "device",
        summary: `Order placed from ${order.shipping_city}, ${order.shipping_country} (${order.ip_address}); fingerprint ${order.device_fingerprint} matches ${priorMatch} prior order(s).`,
        data,
      };
    }
  }
  return mockDevice(ctx);
}

function mockDevice(ctx: DisputeContext): EvidenceRecord<DeviceData> {
  const data: DeviceData = {
    ipAddress: "73.221.18.42",
    ipCity: "Springfield",
    ipCountry: "US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15",
    deviceFingerprint: "fp_8a2c91e4f3",
    fingerprintMatchesPriorOrders: true,
    ipMatchesShippingCountry: true,
    priorOrdersWithSameFingerprint: 3,
    source: "mock",
  };
  return {
    id: `ev_device_${ctx.disputeId.slice(-8)}`,
    kind: "device",
    summary: `Order placed from ${data.ipCity}, ${data.ipCountry} (${data.ipAddress}); device fingerprint matches prior orders. (mock)`,
    data,
  };
}
