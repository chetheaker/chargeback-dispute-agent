/**
 * Launch backend (Hono on :3000) and frontend (Vite on :5173) together.
 * Streams both stdouts with prefixed labels.
 */

const procs: { name: string; color: string; proc: ReturnType<typeof Bun.spawn> }[] = [];

function start(name: string, color: string, cmd: string[], cwd?: string) {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  procs.push({ name, color, proc });
  pipeWithPrefix(proc.stdout, name, color);
  pipeWithPrefix(proc.stderr, name, color);
  return proc;
}

async function pipeWithPrefix(
  stream: ReadableStream<Uint8Array>,
  name: string,
  color: string,
) {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      console.log(`${color}[${name}]\x1b[0m ${line}`);
    }
  }
  if (buf) console.log(`${color}[${name}]\x1b[0m ${buf}`);
}

start("server", "\x1b[36m", ["bun", "run", "--hot", "src/index.ts"]);
start("web", "\x1b[35m", ["bun", "run", "dev"], "web");

const shutdown = () => {
  for (const { proc } of procs) proc.kill();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.all(procs.map((p) => p.proc.exited));
