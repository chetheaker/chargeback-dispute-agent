import Anthropic from "@anthropic-ai/sdk";
import type { DisputeContext, EvidenceRecord } from "../types.ts";
import { fetchOrder } from "../evidence/orders.ts";
import { fetchComms } from "../evidence/comms.ts";
import { fetchDevice } from "../evidence/device.ts";
import { fetchDelivery } from "../evidence/delivery.ts";
import { fetchHistory } from "../evidence/history.ts";
import { fetchTerms } from "../evidence/terms.ts";

type Fetcher = (ctx: DisputeContext) => Promise<EvidenceRecord>;

export const evidenceFetchers: Record<string, Fetcher> = {
  fetch_order: fetchOrder,
  fetch_comms: fetchComms,
  fetch_device: fetchDevice,
  fetch_delivery: fetchDelivery,
  fetch_history: fetchHistory,
  fetch_terms: fetchTerms,
};

export const evidenceTools: Anthropic.Tool[] = [
  {
    name: "fetch_order",
    description:
      "Fetch the order tied to the disputed charge: items, prices, billing/shipping addresses, totals.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fetch_comms",
    description:
      "Fetch all customer communications (email/chat) related to this order, including any acknowledgements.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fetch_device",
    description:
      "Fetch IP address, geolocation, user agent, and device fingerprint captured at order time.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fetch_delivery",
    description:
      "Fetch carrier, tracking number, ship/deliver timestamps, and proof of delivery (signature if present).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fetch_history",
    description:
      "Fetch the customer's order history with the merchant: tenure, total orders, prior chargebacks.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fetch_terms",
    description:
      "Fetch the Terms of Service and Refund Policy the customer accepted, including version, timestamp, and IP.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

export const finalizeTool: Anthropic.Tool = {
  name: "finalize_dispute",
  description:
    "Call this once you have gathered enough evidence. Returns the final reason code, representment narrative, the Stripe evidence dict, and the IDs of evidence records cited in the narrative.",
  input_schema: {
    type: "object",
    properties: {
      reason_code: {
        type: "string",
        description:
          "Stripe dispute reason: fraudulent | product_not_received | product_unacceptable | duplicate | subscription_canceled | credit_not_processed | general | unrecognized | check_returned | bank_cannot_process | debit_not_authorized | customer_initiated",
      },
      narrative: {
        type: "string",
        description:
          "Representment argument, plain text, 200–500 words. Cite specific evidence record IDs inline like [ev_order_...].",
      },
      cited_evidence_ids: {
        type: "array",
        items: { type: "string" },
        description: "All evidence record IDs cited by the narrative.",
      },
      stripe_evidence: {
        type: "object",
        description:
          "Map of Stripe evidence fields to plain-text values. Use uncategorized_text for the narrative. Populate fields relevant to the reason code (e.g., shipping_* for product_not_received, customer_purchase_ip + customer_signature for fraudulent).",
        additionalProperties: { type: "string" },
      },
    },
    required: [
      "reason_code",
      "narrative",
      "cited_evidence_ids",
      "stripe_evidence",
    ],
  },
};

export const allTools: Anthropic.Tool[] = [...evidenceTools, finalizeTool];
