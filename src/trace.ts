import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = "traces";

export interface TraceEvent {
  ts: number;
  disputeId: string;
  type: string;
  data?: unknown;
}

let ready: Promise<void> | null = null;
async function ensureDir() {
  if (!ready) ready = mkdir(DIR, { recursive: true }).then(() => undefined);
  return ready;
}

export async function trace(
  disputeId: string,
  type: string,
  data?: unknown,
): Promise<void> {
  await ensureDir();
  const event: TraceEvent = { ts: Date.now(), disputeId, type, data };
  const line = JSON.stringify(event) + "\n";
  const path = join(DIR, `${disputeId}.jsonl`);
  await appendFile(path, line, "utf8");
  console.log(`[${disputeId}] ${type}`, data ? summarize(data) : "");
}

function summarize(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? s.slice(0, 200) + "…" : s;
  } catch {
    return "";
  }
}
