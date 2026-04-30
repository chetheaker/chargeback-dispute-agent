import { useEffect, useState } from "react";
import { createScenario, listCustomers, listProducts } from "../api";
import type {
  CustomerSummary,
  Product,
  ScenarioReason,
} from "../types";

const REASONS: { id: ScenarioReason; label: string; hint: string }[] = [
  {
    id: "fraudulent",
    label: "Fraudulent",
    hint: "Cardholder claims they didn't authorize the charge.",
  },
  {
    id: "product_not_received",
    label: "Product not received",
    hint: "Cardholder claims the goods never arrived.",
  },
  {
    id: "unrecognized",
    label: "Unrecognized",
    hint: "Cardholder doesn't recognize the merchant on their statement.",
  },
];

interface Props {
  onCreated: () => void;
}

export function ScenarioCreator({ onCreated }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [reason, setReason] = useState<ScenarioReason>("fraudulent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProducts().then((p) => {
      setProducts(p);
      if (p.length && !productId) setProductId(p[0]!.id);
    });
    listCustomers().then(setCustomers);
  }, []);

  const onSubmit = async () => {
    if (!productId) return;
    setBusy(true);
    setError(null);
    try {
      await createScenario({
        productId,
        reason,
        customerId: customerId || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const product = products.find((p) => p.id === productId);

  return (
    <section className="scenario-creator">
      <div className="scenario-title">Create scenario</div>

      <label className="field">
        <span>Product</span>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — ${(p.priceMinor / 100).toFixed(2)}
            </option>
          ))}
        </select>
      </label>
      {product && (
        <div className="field-hint">
          <span className="category-pill">{product.category}</span>{" "}
          {product.description}
        </div>
      )}

      <label className="field">
        <span>Customer</span>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">Random</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.city})
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Dispute reason</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as ScenarioReason)}
        >
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-hint">
        {REASONS.find((r) => r.id === reason)?.hint}
      </div>

      {error && <div className="error">{error}</div>}

      <button
        className="btn btn-primary scenario-btn"
        onClick={onSubmit}
        disabled={busy || !productId}
      >
        {busy ? "Creating…" : "Create dispute"}
      </button>
    </section>
  );
}
