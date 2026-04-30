import { db } from "./db.ts";

interface ProductSeed {
  id: string;
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  category: "physical" | "digital" | "subscription";
  sku: string;
}

interface CustomerSeed {
  id: string;
  email: string;
  name: string;
  created_at: number;
  address_line1: string;
  address_city: string;
  address_postal_code: string;
  address_country: string;
  default_ip: string;
  default_fingerprint: string;
  default_user_agent: string;
}

const SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const PRODUCTS: ProductSeed[] = [
  {
    id: "prod_anc_pro",
    name: "ANC-PRO Wireless Headphones",
    description:
      "Over-ear active noise-cancelling headphones with 40h battery, multipoint Bluetooth 5.4, and lossless USB-C audio.",
    price_minor: 34900,
    currency: "usd",
    category: "physical",
    sku: "ANC-PRO-BLK",
  },
  {
    id: "prod_standing_desk",
    name: "Adjustable Standing Desk",
    description:
      "Electric height-adjustable desk, 60×30in, walnut top with steel frame. Memory presets and anti-collision.",
    price_minor: 49900,
    currency: "usd",
    category: "physical",
    sku: "DESK-ADJ-WAL-60",
  },
  {
    id: "prod_ui_kit",
    name: "Pro UI Component Library",
    description:
      "200+ React components with Figma source files, accessibility-audited, perpetual license.",
    price_minor: 9900,
    currency: "usd",
    category: "digital",
    sku: "UIKIT-PRO-LIC",
  },
  {
    id: "prod_pro_subscription",
    name: "Pro Plan (Annual)",
    description:
      "Annual SaaS subscription — unlimited projects, priority support, advanced analytics.",
    price_minor: 12000,
    currency: "usd",
    category: "subscription",
    sku: "SUB-PRO-ANNUAL",
  },
];

const NOW = Date.now();

const CUSTOMERS: CustomerSeed[] = [
  {
    id: "cust_jane_springfield",
    email: "jane.cooper@example.com",
    name: "Jane Cooper",
    created_at: NOW - 540 * 86400_000,
    address_line1: "742 Evergreen Terrace",
    address_city: "Springfield",
    address_postal_code: "49007",
    address_country: "US",
    default_ip: "73.221.18.42",
    default_fingerprint: "fp_8a2c91e4f3",
    default_user_agent: SAFARI_UA,
  },
  {
    id: "cust_marcus_brooklyn",
    email: "marcus.lin@example.com",
    name: "Marcus Lin",
    created_at: NOW - 220 * 86400_000,
    address_line1: "118 Bedford Avenue, Apt 4B",
    address_city: "Brooklyn",
    address_postal_code: "11211",
    address_country: "US",
    default_ip: "172.58.94.77",
    default_fingerprint: "fp_c1d5b22ee9",
    default_user_agent: CHROME_UA,
  },
  {
    id: "cust_amelia_seattle",
    email: "amelia.park@example.com",
    name: "Amelia Park",
    created_at: NOW - 95 * 86400_000,
    address_line1: "2200 1st Ave",
    address_city: "Seattle",
    address_postal_code: "98121",
    address_country: "US",
    default_ip: "67.180.224.18",
    default_fingerprint: "fp_3f7e019aab",
    default_user_agent: IOS_UA,
  },
];

export function seedIfEmpty() {
  const count = db
    .query<{ n: number }, []>("SELECT count(*) AS n FROM products")
    .get();
  if (count && count.n > 0) return false;

  const insertProduct = db.prepare(
    "INSERT INTO products (id, name, description, price_minor, currency, category, sku) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertCustomer = db.prepare(
    "INSERT INTO customers (id, stripe_customer_id, email, name, created_at, address_line1, address_city, address_postal_code, address_country, default_ip, default_fingerprint, default_user_agent) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const tx = db.transaction(() => {
    for (const p of PRODUCTS) {
      insertProduct.run(
        p.id,
        p.name,
        p.description,
        p.price_minor,
        p.currency,
        p.category,
        p.sku,
      );
    }
    for (const c of CUSTOMERS) {
      insertCustomer.run(
        c.id,
        c.email,
        c.name,
        c.created_at,
        c.address_line1,
        c.address_city,
        c.address_postal_code,
        c.address_country,
        c.default_ip,
        c.default_fingerprint,
        c.default_user_agent,
      );
    }
    // Seed historical orders so each customer has a history (no chargebacks).
    const insertOrder = db.prepare(
      "INSERT INTO orders (id, customer_id, product_id, stripe_payment_intent_id, stripe_charge_id, total_minor, currency, placed_at, ip_address, device_fingerprint, user_agent, billing_line1, billing_city, billing_postal_code, billing_country, shipping_line1, shipping_city, shipping_postal_code, shipping_country) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    let n = 0;
    for (const c of CUSTOMERS) {
      const priorCount = c.id === "cust_jane_springfield" ? 6 : c.id === "cust_marcus_brooklyn" ? 3 : 1;
      for (let i = 0; i < priorCount; i++) {
        const p = PRODUCTS[i % PRODUCTS.length]!;
        const placed = c.created_at + (i + 1) * 30 * 86400_000;
        if (placed >= NOW - 7 * 86400_000) continue; // keep history strictly older than the recent window
        insertOrder.run(
          `ord_seed_${++n}`,
          c.id,
          p.id,
          p.price_minor,
          p.currency,
          placed,
          c.default_ip,
          c.default_fingerprint,
          c.default_user_agent,
          c.address_line1,
          c.address_city,
          c.address_postal_code,
          c.address_country,
          c.address_line1,
          c.address_city,
          c.address_postal_code,
          c.address_country,
        );
      }
    }
  });
  tx();
  return true;
}
