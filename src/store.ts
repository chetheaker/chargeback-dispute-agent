import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AgentResult, DisputeContext } from "./types.ts";

const DIR = "traces";

async function ensureDir() {
  await mkdir(DIR, { recursive: true });
}

export type DisputeStatus =
  | "pending"
  | "running"
  | "ready"
  | "submitted"
  | "won"
  | "lost"
  | "error";

export type OutcomeSource = "stripe" | "simulated";

export interface DisputeRecord {
  context: DisputeContext;
  result?: AgentResult;
  status: DisputeStatus;
  stripeStatus?: string;
  outcome?: "won" | "lost";
  outcomeAt?: number;
  outcomeSource?: OutcomeSource;
  error?: string;
  updatedAt: number;
}

function recordPath(disputeId: string) {
  return join(DIR, `${disputeId}.record.json`);
}

function tracePath(disputeId: string) {
  return join(DIR, `${disputeId}.jsonl`);
}

export async function saveRecord(rec: DisputeRecord): Promise<void> {
  await ensureDir();
  rec.updatedAt = Date.now();
  await writeFile(
    recordPath(rec.context.disputeId),
    JSON.stringify(rec, null, 2),
    "utf8",
  );
}

export async function loadRecord(
  disputeId: string,
): Promise<DisputeRecord | null> {
  try {
    const text = await readFile(recordPath(disputeId), "utf8");
    return JSON.parse(text) as DisputeRecord;
  } catch {
    return null;
  }
}

export async function listRecords(): Promise<DisputeRecord[]> {
  await ensureDir();
  const entries = await readdir(DIR);
  const results: DisputeRecord[] = [];
  for (const e of entries) {
    if (!e.endsWith(".record.json")) continue;
    try {
      const text = await readFile(join(DIR, e), "utf8");
      results.push(JSON.parse(text));
    } catch {}
  }
  results.sort((a, b) => b.updatedAt - a.updatedAt);
  return results;
}

export async function readTrace(disputeId: string): Promise<string> {
  try {
    return await readFile(tracePath(disputeId), "utf8");
  } catch {
    return "";
  }
}

export async function traceMtime(disputeId: string): Promise<number> {
  try {
    const s = await stat(tracePath(disputeId));
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

export function tracePathFor(disputeId: string): string {
  return tracePath(disputeId);
}
