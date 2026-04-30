import type { DisputeContext, EvidenceRecord } from "../types.ts";

export interface DeviceData {
  ipAddress: string;
  ipCountry: string;
  ipCity: string;
  userAgent: string;
  deviceFingerprint: string;
  fingerprintMatchesPriorOrders: boolean;
  ipMatchesShippingCountry: boolean;
}

export async function fetchDevice(
  ctx: DisputeContext,
): Promise<EvidenceRecord<DeviceData>> {
  const data: DeviceData = {
    ipAddress: "73.221.18.42",
    ipCountry: "US",
    ipCity: "Springfield",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15",
    deviceFingerprint: "fp_8a2c91e4f3",
    fingerprintMatchesPriorOrders: true,
    ipMatchesShippingCountry: true,
  };
  return {
    id: `ev_device_${ctx.disputeId.slice(-8)}`,
    kind: "device",
    summary: `Order placed from ${data.ipCity}, ${data.ipCountry} (${data.ipAddress}); device fingerprint matches prior orders.`,
    data,
  };
}
