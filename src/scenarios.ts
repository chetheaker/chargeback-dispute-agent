import { stripe } from "./stripe/client.ts";
import { db, queries, type CustomerRow, type ProductRow } from "./db.ts";

export type ScenarioReason = "fraudulent" | "product_not_received" | "unrecognized";

const REASON_TO_PM: Record<ScenarioReason, string> = {
  fraudulent: "pm_card_createDispute",
  product_not_received: "pm_card_createDisputeProductNotReceived",
  unrecognized: "pm_card_createDispute",
};

export interface CreateScenarioOpts {
  productId: string;
  reason: ScenarioReason;
  customerId?: string;
}

export interface CreateScenarioResult {
  orderId: string;
  customerId: string;
  paymentIntentId: string;
  chargeId: string | null;
  status: string;
}

function pickRandomCustomer(): CustomerRow {
  const all = queries.listCustomers.all();
  if (all.length === 0) throw new Error("no customers seeded");
  return all[Math.floor(Math.random() * all.length)]!;
}

function shortId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++)
    id += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}_${id}`;
}

async function ensureStripeCustomer(c: CustomerRow): Promise<string> {
  if (c.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(c.stripe_customer_id);
      if (!("deleted" in existing) || !existing.deleted) {
        return c.stripe_customer_id;
      }
    } catch {
      // fall through and recreate
    }
  }
  const created = await stripe.customers.create({
    email: c.email,
    name: c.name,
    address: {
      line1: c.address_line1,
      city: c.address_city,
      postal_code: c.address_postal_code,
      country: c.address_country,
    },
    metadata: { internal_customer_id: c.id },
  });
  queries.setCustomerStripeId.run(created.id, c.id);
  return created.id;
}

export async function createScenario(
  opts: CreateScenarioOpts,
): Promise<CreateScenarioResult> {
  const product = queries.getProduct.get(opts.productId);
  if (!product) throw new Error(`unknown product: ${opts.productId}`);

  const customer = opts.customerId
    ? queries.getCustomer.get(opts.customerId)
    : pickRandomCustomer();
  if (!customer) throw new Error("customer not found");

  const orderId = shortId("ord");
  const placedAt = Date.now() - 5 * 86400_000;

  insertOrderAndEvidence(product, customer, orderId, placedAt, opts.reason);

  const stripeCustomerId = await ensureStripeCustomer(customer);

  const pi = await stripe.paymentIntents.create({
    amount: product.price_minor,
    currency: product.currency,
    customer: stripeCustomerId,
    payment_method: REASON_TO_PM[opts.reason],
    confirm: true,
    description: `${product.name} (${product.sku})`,
    return_url: "http://localhost:5173/return",
    metadata: {
      internal_order_id: orderId,
      internal_customer_id: customer.id,
      scenario_reason: opts.reason,
    },
  });

  const chargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : (pi.latest_charge?.id ?? null);

  db.run(
    "UPDATE orders SET stripe_payment_intent_id = ?, stripe_charge_id = ? WHERE id = ?",
    [pi.id, chargeId, orderId],
  );

  return {
    orderId,
    customerId: customer.id,
    paymentIntentId: pi.id,
    chargeId,
    status: pi.status,
  };
}

function insertOrderAndEvidence(
  product: ProductRow,
  customer: CustomerRow,
  orderId: string,
  placedAt: number,
  reason: ScenarioReason,
) {
  const insertOrder = db.prepare(
    "INSERT INTO orders (id, customer_id, product_id, stripe_payment_intent_id, stripe_charge_id, total_minor, currency, placed_at, ip_address, device_fingerprint, user_agent, billing_line1, billing_city, billing_postal_code, billing_country, shipping_line1, shipping_city, shipping_postal_code, shipping_country) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertShipment = db.prepare(
    "INSERT INTO shipments (id, order_id, carrier, tracking_number, shipped_at, delivered_at, signed_by, proof_url, delivery_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTerms = db.prepare(
    "INSERT INTO terms_acceptances (id, customer_id, order_id, terms_version, terms_url, refund_policy, refund_policy_url, checkbox_text, accepted_at, accepted_from_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertComm = db.prepare(
    "INSERT INTO communications (id, order_id, customer_id, ts, direction, channel, subject, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const tx = db.transaction(() => {
    insertOrder.run(
      orderId,
      customer.id,
      product.id,
      product.price_minor,
      product.currency,
      placedAt,
      customer.default_ip,
      customer.default_fingerprint,
      customer.default_user_agent,
      customer.address_line1,
      customer.address_city,
      customer.address_postal_code,
      customer.address_country,
      customer.address_line1,
      customer.address_city,
      customer.address_postal_code,
      customer.address_country,
    );

    if (product.category === "physical") {
      insertShipment.run(
        shortId("shp"),
        orderId,
        "UPS",
        randomTracking(),
        placedAt + 2 * 86400_000,
        placedAt + 4 * 86400_000,
        signaturFor(customer.name),
        "https://www.ups.com/track?tracknum=" + randomTracking(),
        `${customer.address_line1}, ${customer.address_city}, ${customer.address_postal_code}, ${customer.address_country}`,
      );
    }

    insertTerms.run(
      shortId("ta"),
      customer.id,
      orderId,
      "2025-09-01",
      "https://example.com/terms",
      "All sales final after 14 days. Refunds available within 14 days of delivery for unopened items in original condition.",
      "https://example.com/refunds",
      "I agree to the Terms of Service and Refund Policy.",
      placedAt - 60_000,
      customer.default_ip,
    );

    insertComm.run(
      shortId("msg"),
      orderId,
      customer.id,
      placedAt + 60_000,
      "outbound",
      "email",
      `Order confirmation — ${product.name}`,
      `Hi ${firstName(customer.name)}, thanks for your order of ${product.name}. ` +
        (product.category === "physical"
          ? "We'll ship within 2 business days. Reply if anything looks off."
          : product.category === "digital"
            ? "Your license key and download links are now available in your account."
            : "Your subscription is active. Manage it any time from your dashboard."),
    );

    if (product.category === "physical") {
      insertComm.run(
        shortId("msg"),
        orderId,
        customer.id,
        placedAt + 2 * 86400_000,
        "outbound",
        "email",
        "Shipped — tracking inside",
        `Your order shipped via UPS. Tracking link: https://www.ups.com/`,
      );

      // For fraudulent: include customer's own acknowledgement (strong evidence
      // contradicting an "unauthorized" claim).
      if (reason === "fraudulent" || reason === "unrecognized") {
        insertComm.run(
          shortId("msg"),
          orderId,
          customer.id,
          placedAt + 4 * 86400_000 + 3600_000,
          "inbound",
          "email",
          "Re: Shipped — tracking inside",
          `Got it, thanks!`,
        );
      } else if (reason === "product_not_received") {
        // Customer asks where the package is; we reply with tracking.
        insertComm.run(
          shortId("msg"),
          orderId,
          customer.id,
          placedAt + 5 * 86400_000,
          "inbound",
          "email",
          "Where is my order?",
          `Hi, I haven't seen my package — can you check?`,
        );
        insertComm.run(
          shortId("msg"),
          orderId,
          customer.id,
          placedAt + 5 * 86400_000 + 1800_000,
          "outbound",
          "email",
          "Re: Where is my order?",
          `Tracking shows it was delivered on the morning of day 4 and signed for at your address. Can you check with neighbours or building reception?`,
        );
      }
    } else if (product.category === "digital") {
      insertComm.run(
        shortId("msg"),
        orderId,
        customer.id,
        placedAt + 30 * 60_000,
        "outbound",
        "email",
        "Your license key",
        `License key: UI-PRO-${shortId("k").toUpperCase()}. Download links inside your account.`,
      );
    }
  });
  tx();
}

function randomTracking(): string {
  const n = Math.floor(Math.random() * 10_000_000_000_000_000)
    .toString()
    .padStart(16, "0");
  return `1Z999AA1${n.slice(-10)}`;
}

function signaturFor(name: string): string {
  const parts = name.split(" ");
  const first = parts[0]?.[0] ?? "X";
  const last = parts.slice(1).join(" ").toUpperCase();
  return `${first}. ${last}`;
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
