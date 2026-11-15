import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const FILE = "data/history.json";
const monitors = JSON.parse(readFileSync("monitors.json", "utf8"));
const db = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { monitors: {} };
const now = Date.now();
const keepFrom = now - 30 * 864e5;

// "200-299" ranges or single codes like 301
const accepted = (code, rules) =>
  rules.some((r) => {
    const [a, b] = String(r).split("-").map(Number);
    return b ? code >= a && code <= b : code === a;
  });

await Promise.all(
  monitors.map(async (m) => {
    const t0 = Date.now();
    let state = 2; // 0 up, 1 degraded (slow), 2 down
    try {
      const res = await fetch(m.url, {
        method: m.method || "GET",
        redirect: m.followRedirect === false ? "manual" : "follow",
        signal: AbortSignal.timeout(10000),
        headers: { "user-agent": "AtherixStatus/1.0" },
      });
      if (accepted(res.status, m.acceptedStatusCodes || ["200-299"])) {
        state = Date.now() - t0 >= 4000 ? 1 : 0;
      }
    } catch {}
    const entry = (db.monitors[m.id] ??= { checks: [] });
    entry.name = m.name;
    entry.checks.push([now, state, Date.now() - t0]);
    entry.checks = entry.checks.filter((c) => c[0] >= keepFrom);
  })
);

mkdirSync("data", { recursive: true });
writeFileSync(FILE, JSON.stringify(db));
