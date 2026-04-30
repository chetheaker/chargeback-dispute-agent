import type { DisputeContext, EvidenceRecord } from "../types.ts";

export interface CommsData {
  messages: {
    ts: string;
    direction: "inbound" | "outbound";
    channel: "email" | "chat";
    subject?: string;
    body: string;
  }[];
}

export async function fetchComms(
  ctx: DisputeContext,
): Promise<EvidenceRecord<CommsData>> {
  const t0 = ctx.createdAt - 5 * 86400_000;
  const data: CommsData = {
    messages: [
      {
        ts: new Date(t0).toISOString(),
        direction: "outbound",
        channel: "email",
        subject: "Order confirmation",
        body: `Thanks for your order. We'll ship within 2 business days. Reply to this email if anything looks off.`,
      },
      {
        ts: new Date(t0 + 2 * 86400_000).toISOString(),
        direction: "outbound",
        channel: "email",
        subject: "Shipped — tracking inside",
        body: `Your order shipped via UPS. Tracking 1Z999AA10123456784.`,
      },
      {
        ts: new Date(t0 + 4 * 86400_000).toISOString(),
        direction: "inbound",
        channel: "email",
        subject: "Re: Shipped — tracking inside",
        body: `Got it, thanks!`,
      },
    ],
  };
  return {
    id: `ev_comms_${ctx.disputeId.slice(-8)}`,
    kind: "comms",
    summary: `${data.messages.length} messages with customer; customer acknowledged shipment.`,
    data,
  };
}
