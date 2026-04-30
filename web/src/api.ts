import type { DisputeRecord, DisputeSummary } from "./types";

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
