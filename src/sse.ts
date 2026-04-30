import { tracePathFor } from "./store.ts";
import { stat, open } from "node:fs/promises";
import { watch } from "node:fs";

export function streamTrace(disputeId: string): Response {
  const path = tracePathFor(disputeId);
  const encoder = new TextEncoder();
  let watcher: ReturnType<typeof watch> | null = null;
  let closed = false;
  let pos = 0;
  let pollTimer: Timer | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
          );
        } catch {}
      };

      const drain = async () => {
        try {
          const s = await stat(path);
          if (s.size <= pos) return;
          const fh = await open(path, "r");
          try {
            const len = s.size - pos;
            const buf = Buffer.alloc(len);
            await fh.read(buf, 0, len, pos);
            pos = s.size;
            const text = buf.toString("utf8");
            for (const line of text.split("\n")) {
              if (!line.trim()) continue;
              send("trace", line);
            }
          } finally {
            await fh.close();
          }
        } catch {}
      };

      send("hello", JSON.stringify({ disputeId }));

      // Initial drain (file may already have content)
      try {
        const s = await stat(path);
        pos = 0;
        void s;
        await drain();
      } catch {
        // file doesn't exist yet — that's fine, watcher/poll will pick it up
      }

      // Watch for appends. fs.watch isn't reliable on all platforms for
      // append-only files, so also poll every 500ms as a backstop.
      try {
        watcher = watch(path, () => {
          drain();
        });
      } catch {}
      pollTimer = setInterval(drain, 500);
    },
    cancel() {
      closed = true;
      if (watcher) watcher.close();
      if (pollTimer) clearInterval(pollTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
