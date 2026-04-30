import type {
  CreateScenarioRequest,
  CreateScenarioResponse,
  CustomerSummary,
  DisputeRecord,
  DisputeSummary,
  Product,
} from "./types";

export async function listDisputes(): Promise<DisputeSummary[]> {
  const r = await fetch("/api/disputes");
  if (!r.ok) throw new Error(`listDisputes ${r.status}`);
  return r.json();
}

export async function getDispute(id: string): Promise<DisputeRecord> {
  const r = await fetch(`/api/disputes/${id}`);
  if (!r.ok) throw new Error(`getDispute ${r.status}`);
  return r.json();
}

export async function submitDispute(id: string) {
  const r = await fetch(`/api/disputes/${id}/submit`, { method: "POST" });
  if (!r.ok) throw new Error(`submit ${r.status}`);
  return r.json();
}

export async function rerunDispute(id: string) {
  const r = await fetch(`/api/disputes/${id}/rerun`, { method: "POST" });
  if (!r.ok) throw new Error(`rerun ${r.status}`);
  return r.json();
}

export async function triggerDemo() {
  const r = await fetch("/api/demo/trigger", { method: "POST" });
  if (!r.ok) throw new Error(`trigger ${r.status}`);
  return r.json();
}

export async function listProducts(): Promise<Product[]> {
  const r = await fetch("/api/products");
  if (!r.ok) throw new Error(`listProducts ${r.status}`);
  return r.json();
}

export async function listCustomers(): Promise<CustomerSummary[]> {
  const r = await fetch("/api/customers");
  if (!r.ok) throw new Error(`listCustomers ${r.status}`);
  return r.json();
}

export async function createScenario(
  body: CreateScenarioRequest,
): Promise<CreateScenarioResponse> {
  const r = await fetch("/api/scenarios", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`createScenario ${r.status} ${await r.text()}`);
  return r.json();
}

export async function resetDatabase() {
  const r = await fetch("/api/db/reset", { method: "POST" });
  if (!r.ok) throw new Error(`reset ${r.status}`);
  return r.json();
}

