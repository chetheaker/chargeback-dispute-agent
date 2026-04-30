import type { DisputeContext, EvidenceRecord } from "../types.ts";
import { queries } from "../db.ts";

export interface CommsData {
  messages: {
    id?: string;
    ts: string;
    direction: "inbound" | "outbound";
    channel: "email" | "chat";
    subject?: string;
    body: string;
  }[];
  source: "db" | "mock";
}

export async function fetchComms(
  ctx: DisputeContext,
): Promise<EvidenceRecord<CommsData>> {
  if (ctx.internalOrderId) {
    const rows = queries.commsForOrder.all(ctx.internalOrderId);
    if (rows.length > 0) {
      const data: CommsData = {
        messages: rows.map((r) => ({
          id: r.id,
          ts: new Date(r.ts).toISOString(),
          direction: r.direction,
          channel: r.channel,
          subject: r.subject ?? undefined,
          body: r.body,
        })),
        source: "db",
      };
      const inbound = rows.filter((r) => r.direction === "inbound").length;
      return {
        id: `ev_comms_${ctx.internalOrderId}`,
        kind: "comms",
        summary: `${rows.length} messages with customer (${inbound} inbound, ${rows.length - inbound} outbound).`,
        data,
      };
    }
  }
  return mockComms(ctx);
}

function mockComms(ctx: DisputeContext): EvidenceRecord<CommsData> {
  const t0 = ctx.createdAt - 5 * 86400_000;
  const data: CommsData = {
    messages: [
      {
        ts: new Date(t0).toISOString(),
        direction: "outbound",
        channel: "email",
        subject: "Order confirmation",
        body: "Thanks for your order. We'll ship within 2 business days.",
      },
      {
        ts: new Date(t0 + 2 * 86400_000).toISOString(),
        direction: "outbound",
        channel: "email",
        subject: "Shipped — tracking inside",
        body: "Your order shipped via UPS.",
      },
      {
        ts: new Date(t0 + 4 * 86400_000).toISOString(),
        direction: "inbound",
        channel: "email",
        subject: "Re: Shipped — tracking inside",
        body: "Got it, thanks!",
      },
    ],
    source: "mock",
  };
  return {
    id: `ev_comms_${ctx.disputeId.slice(-8)}`,
    kind: "comms",
    summary: `${data.messages.length} messages with customer; customer acknowledged shipment. (mock)`,
    data,
  };
}
