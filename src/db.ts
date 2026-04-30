import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

mkdirSync("data", { recursive: true });

export const db = new Database("data/app.db", { create: true });

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    category TEXT NOT NULL CHECK(category IN ('physical','digital','subscription')),
    sku TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    stripe_customer_id TEXT,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    address_line1 TEXT NOT NULL,
    address_city TEXT NOT NULL,
    address_postal_code TEXT NOT NULL,
    address_country TEXT NOT NULL,
    default_ip TEXT NOT NULL,
    default_fingerprint TEXT NOT NULL,
    default_user_agent TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    total_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    placed_at INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    billing_line1 TEXT NOT NULL,
    billing_city TEXT NOT NULL,
    billing_postal_code TEXT NOT NULL,
    billing_country TEXT NOT NULL,
    shipping_line1 TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_postal_code TEXT NOT NULL,
    shipping_country TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_pi ON orders(stripe_payment_intent_id);

  CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    carrier TEXT NOT NULL,
    tracking_number TEXT NOT NULL,
    shipped_at INTEGER,
    delivered_at INTEGER,
    signed_by TEXT,
    proof_url TEXT,
    delivery_address TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);

  CREATE TABLE IF NOT EXISTS terms_acceptances (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    order_id TEXT NOT NULL REFERENCES orders(id),
    terms_version TEXT NOT NULL,
    terms_url TEXT NOT NULL,
    refund_policy TEXT NOT NULL,
    refund_policy_url TEXT NOT NULL,
    checkbox_text TEXT NOT NULL,
    accepted_at INTEGER NOT NULL,
    accepted_from_ip TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_terms_order ON terms_acceptances(order_id);

  CREATE TABLE IF NOT EXISTS communications (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    ts INTEGER NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
    channel TEXT NOT NULL CHECK(channel IN ('email','chat')),
    subject TEXT,
    body TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comms_order ON communications(order_id);
`);

export interface ProductRow {
  id: string;
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  category: "physical" | "digital" | "subscription";
  sku: string;
}

export interface CustomerRow {
  id: string;
  stripe_customer_id: string | null;
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

export interface OrderRow {
  id: string;
  customer_id: string;
  product_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  total_minor: number;
  currency: string;
  placed_at: number;
  ip_address: string;
  device_fingerprint: string;
  user_agent: string;
  billing_line1: string;
  billing_city: string;
  billing_postal_code: string;
  billing_country: string;
  shipping_line1: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
}

export interface ShipmentRow {
  id: string;
  order_id: string;
  carrier: string;
  tracking_number: string;
  shipped_at: number | null;
  delivered_at: number | null;
  signed_by: string | null;
  proof_url: string | null;
  delivery_address: string;
}

export interface TermsRow {
  id: string;
  customer_id: string;
  order_id: string;
  terms_version: string;
  terms_url: string;
  refund_policy: string;
  refund_policy_url: string;
  checkbox_text: string;
  accepted_at: number;
  accepted_from_ip: string;
}

export interface CommRow {
  id: string;
  order_id: string;
  customer_id: string;
  ts: number;
  direction: "inbound" | "outbound";
  channel: "email" | "chat";
  subject: string | null;
  body: string;
}

export const queries = {
  listProducts: db.query<ProductRow, []>("SELECT * FROM products ORDER BY price_minor"),
  getProduct: db.query<ProductRow, [string]>("SELECT * FROM products WHERE id = ?"),
  listCustomers: db.query<CustomerRow, []>("SELECT * FROM customers ORDER BY created_at"),
  getCustomer: db.query<CustomerRow, [string]>("SELECT * FROM customers WHERE id = ?"),
  setCustomerStripeId: db.query<unknown, [string, string]>(
    "UPDATE customers SET stripe_customer_id = ? WHERE id = ?",
  ),
  getOrder: db.query<OrderRow, [string]>("SELECT * FROM orders WHERE id = ?"),
  getOrderByPI: db.query<OrderRow, [string]>(
    "SELECT * FROM orders WHERE stripe_payment_intent_id = ?",
  ),
  ordersForCustomer: db.query<OrderRow, [string, string]>(
    "SELECT * FROM orders WHERE customer_id = ? AND id != ? ORDER BY placed_at DESC",
  ),
  setOrderCharge: db.query<unknown, [string, string]>(
    "UPDATE orders SET stripe_charge_id = ? WHERE id = ?",
  ),
  shipmentsForOrder: db.query<ShipmentRow, [string]>(
    "SELECT * FROM shipments WHERE order_id = ?",
  ),
  termsForOrder: db.query<TermsRow, [string]>(
    "SELECT * FROM terms_acceptances WHERE order_id = ? LIMIT 1",
  ),
  commsForOrder: db.query<CommRow, [string]>(
    "SELECT * FROM communications WHERE order_id = ? ORDER BY ts ASC",
  ),
};
