// Drives mcp.mjs over stdio the way an MCP client does, against a copy of the site served from this checkout.
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import http from "node:http";
import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// A two-listing site in a temp directory, so the test depends on the server, not on the state of the 125 records.
const L = {
  "cal--diy": { slug: "cal--diy", name: "Cal.diy", tagline: "Self-hosted booking pages with API v2.", useWhen: ["I want a booking page I host"], alternativeTo: ["Calendly"], accounts: [], gotchas: ["AGPL"], vertical: "scheduling-staffing", shape: "business-app", capabilities: ["adaptable", "operable"], effort: "config-only", editCount: 4, operability: "official", coverage: "complete", interfaceKind: "api", license: "MIT", paid: false, url: "apps/cal--diy.html" },
  "acme--notes": { slug: "acme--notes", name: "Acme Notes", tagline: "Notes with an MCP server.", useWhen: ["I want notes my agent can read"], alternativeTo: ["Notion"], accounts: [], gotchas: [], vertical: "notes-knowledge", shape: "business-app", capabilities: ["operable"], effort: null, editCount: null, operability: "native", coverage: "complete", interfaceKind: "mcp", license: "Apache-2.0", paid: false, url: "apps/acme--notes.html" },
};
const STACKS = [{ slug: "barbershop", name: "Run a barbershop with your agent", page: "stacks/barbershop.html", markdown: "stacks/barbershop.md", checkedOn: "2026-11-14",
  roles: [{ job: "Bookings", listing: "cal--diy", name: "Cal.diy", url: "apps/cal--diy.html" }], handoffs: [] }];
function fixture({ stacks = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mm-mcp-"));
  fs.mkdirSync(path.join(root, "index")); fs.mkdirSync(path.join(root, "apps"));
  fs.writeFileSync(path.join(root, "index/search.json"), JSON.stringify({ version: 1, count: 2, listings: Object.values(L) }));
  fs.writeFileSync(path.join(root, "index/alternatives.json"), JSON.stringify({ products: [{ product: "Calendly", page: "alternatives/calendly.html" }, { product: "Notion", page: null }] }));
  fs.writeFileSync(path.join(root, "index/vocab.json"), JSON.stringify({ fields: [{ name: "vertical", values: [{ value: "scheduling-staffing", count: 1 }, { value: "notes-knowledge", count: 1 }] }] }));
  if (stacks) fs.writeFileSync(path.join(root, "index/stacks.json"), JSON.stringify({ version: "2", count: STACKS.length, stacks: STACKS }));
  for (const [slug, l] of Object.entries(L)) fs.writeFileSync(path.join(root, `apps/${slug}.json`), JSON.stringify({ listing: { ...l, description: `${l.name} in full.`, repos: [{ url: `https://github.com/${slug.replace("--", "/")}`, license: l.license, stars: 10, lastCommit: "2026-09-01" }], editions: [], customization: l.effort ? { effort: l.effort, editCount: l.editCount, summary: "Edit .env.", envVars: ["DATABASE_URL"] } : null, interface: { kind: l.interfaceKind }, reach: [], confidence: {}, openQuestions: [] } }));
  return root;
}
const TYPES = { ".json": "application/json", ".html": "text/html", ".txt": "text/plain" };
function serve(opts) {
  const root = fixture(opts); const seen = [];
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      seen.push(req.url.split("?")[0]);
      const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("no"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
    });
    s.listen(0, "127.0.0.1", () => resolve({ base: `http://127.0.0.1:${s.address().port}`, seen, close: () => s.close() }));
  });
}
// One server process; send JSON-RPC lines, collect replies by id.
function client(base) {
  const p = spawn(process.execPath, [path.join(here, "mcp.mjs"), "--base", base], { stdio: ["pipe", "pipe", "pipe"] });
  let buf = "", stderr = ""; const waiting = new Map(); let nextId = 1;
  p.stdout.on("data", d => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; const m = JSON.parse(line); waiting.get(m.id)?.(m); waiting.delete(m.id); } });
  p.stderr.on("data", d => { stderr += d; });
  const call = (method, params) => new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, resolve); p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); setTimeout(() => reject(new Error(`no reply to ${method}; stderr: ${stderr}`)), 15000); });
  const notify = (method, params) => p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  return { call, notify, kill: () => p.kill(), stderr: () => stderr };
}
const text = r => JSON.parse(r.result.content[0].text);

test("the MCP server answers the handshake and exposes search, listing and vocab as read-only tools", async () => {
  const site = await serve(); const c = client(site.base);
  try {
    const init = await c.call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    assert.equal(init.result.protocolVersion, "2025-06-18");
    assert.equal(init.result.serverInfo.name, "mothermachine");
    assert.deepEqual(Object.keys(init.result.capabilities), ["tools"]);
    c.notify("notifications/initialized", {});
    const list = await c.call("tools/list", {});
    assert.deepEqual(list.result.tools.map(t => t.name).sort(), ["listing", "search", "vocab"]);
    for (const t of list.result.tools) { assert.ok(t.description.length > 20, t.name); assert.equal(t.inputSchema.type, "object"); assert.equal(t.annotations.readOnlyHint, true); }
    const ping = await c.call("ping", {}); assert.deepEqual(ping.result, {});
  } finally { c.kill(); site.close(); }
});

test("search ranks with the same function the skill uses, honours filters, and returns page links on the site", async () => {
  const site = await serve(); const c = client(site.base);
  try {
    await c.call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    const r = text(await c.call("tools/call", { name: "search", arguments: { query: "replace calendly", limit: 3 } }));
    assert.equal(r.query, "replace calendly");
    assert.ok(r.results.length >= 1 && r.results.length <= 3);
    assert.ok(r.results.every(x => x.slug && x.page.startsWith(`${site.base}/apps/`) && x.json.startsWith(`${site.base}/apps/`)));
    assert.equal(r.results[0].slug, "cal--diy", "alternativeTo is searched"); assert.equal(r.searched, 2);
    const f = text(await c.call("tools/call", { name: "search", arguments: { query: "", vertical: "notes-knowledge", operable: true } }));
    assert.ok(f.results.length > 0 && f.results.every(x => x.vertical === "notes-knowledge" && x.capabilities.includes("operable")));
    const none = text(await c.call("tools/call", { name: "search", arguments: { query: "kubernetes operator for mainframes" } }));
    assert.equal(none.results.length, 0); assert.match(none.hint, /fewer words|vertical/);
  } finally { c.kill(); site.close(); }
});

test("search takes interface and open as filters, links the compare page, and says when a result is thin", async () => {
  const site = await serve(); const c = client(site.base);
  try {
    await c.call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    const tool = (await c.call("tools/list")).result.tools.find(t => t.name === "search");
    assert.ok(tool.inputSchema.properties.interface && tool.inputSchema.properties.open, "the schema offers both filters");
    const mcp = text(await c.call("tools/call", { name: "search", arguments: { query: "", interface: "mcp" } }));
    assert.deepEqual(mcp.results.map(x => x.slug), ["acme--notes"]);
    const open = text(await c.call("tools/call", { name: "search", arguments: { query: "", open: true } }));
    assert.deepEqual(open.results.map(x => x.slug).sort(), ["acme--notes", "cal--diy"], "both fixture licenses are open source");
    const r = text(await c.call("tools/call", { name: "search", arguments: { query: "calendly" } }));
    assert.deepEqual(r.compare, [{ product: "Calendly", page: `${site.base}/alternatives/calendly.html` }]);
    assert.match(r.hint, /Thin result/);
    const n = text(await c.call("tools/call", { name: "search", arguments: { query: "notion" } }));
    assert.deepEqual(n.compare, [], "a product without a page gets no link");
  } finally { c.kill(); site.close(); }
});

test("search returns the stack for a kind of business, and fetches stacks only for one", async () => {
  const site = await serve(); const c = client(site.base);
  try {
    await c.call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    const tool = (await c.call("tools/list")).result.tools.find(t => t.name === "search");
    assert.match(tool.description, /kind of business/, "the tool tells the client it can ask by business");
    const r = text(await c.call("tools/call", { name: "search", arguments: { query: "software for my barbershop" } }));
    assert.deepEqual(r.stacks, [{ slug: "barbershop", name: "Run a barbershop with your agent", page: `${site.base}/stacks/barbershop.html`, markdown: `${site.base}/stacks/barbershop.md`, roles: [{ job: "Bookings", listing: "cal--diy", name: "Cal.diy" }] }]);
    assert.equal(r.hint, undefined, "a stack is an answer, so no thin-result hint");
    const m = text(await c.call("tools/call", { name: "search", arguments: { query: "software for my barbershop", interface: "mcp" } }));
    assert.deepEqual(m.stacks[0].roles, [{ job: "Bookings", listing: "cal--diy", name: "Cal.diy", fits: false }], "Cal.diy is driven over an API, not MCP");
    const before = site.seen.length;
    const p = text(await c.call("tools/call", { name: "search", arguments: { query: "replace calendly" } }));
    assert.deepEqual(p.stacks, []);
    assert.ok(!site.seen.slice(before).includes("/index/stacks.json"), "no business named, no stacks fetch");
  } finally { c.kill(); site.close(); }
});

test("search still answers when the site has no stacks index", async () => {
  const site = await serve({ stacks: false }); const c = client(site.base);
  try {
    await c.call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    const r = text(await c.call("tools/call", { name: "search", arguments: { query: "barbershop booking page" } }));
    assert.deepEqual(r.stacks, []); assert.equal(r.results[0].slug, "cal--diy");
    assert.ok(site.seen.includes("/index/stacks.json"), "it tried");
  } finally { c.kill(); site.close(); }
});

test("listing returns the trimmed record, vocab the controlled values, and bad input is a tool error not a crash", async () => {
  const site = await serve(); const c = client(site.base);
  try {
    await c.call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "old", version: "0" } });
    const l = text(await c.call("tools/call", { name: "listing", arguments: { slug: "cal--diy" } }));
    assert.equal(l.slug, "cal--diy"); assert.ok(l.page.endsWith("/apps/cal--diy.html")); assert.deepEqual(l.adaptable.envVars, ["DATABASE_URL"]); assert.equal(l.repo.stars, 10);
    const v = text(await c.call("tools/call", { name: "vocab", arguments: {} }));
    assert.ok(v.fields.some(f => f.name === "vertical" && f.values.some(x => x.value === "notes-knowledge")));
    const missing = await c.call("tools/call", { name: "listing", arguments: { slug: "nope--nothing" } });
    assert.equal(missing.result.isError, true); assert.match(missing.result.content[0].text, /404|not found/i);
    const bad = await c.call("tools/call", { name: "listing", arguments: { slug: "../index" } });
    assert.equal(bad.result.isError, true);
    const unknownTool = await c.call("tools/call", { name: "delete", arguments: {} });
    assert.equal(unknownTool.error.code, -32602);
    const unknownMethod = await c.call("resources/list", {});
    assert.equal(unknownMethod.error.code, -32601);
    const ok = await c.call("ping", {}); assert.ok(ok.result, "the server is still up after the errors");
  } finally { c.kill(); site.close(); }
});

test("a reply still arrives when the client closes stdin right after sending the request", async () => {
  const site = await serve();
  try {
    const { execFile } = await import("node:child_process");
    const input = [{ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "0" } } },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { query: "calendly" } } }].map(m => JSON.stringify(m)).join("\n") + "\n";
    const out = await new Promise((resolve, reject) => { const p = execFile(process.execPath, [path.join(here, "mcp.mjs"), "--base", site.base], { timeout: 15000 }, (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve(stdout)); p.stdin.end(input); });
    const ids = out.trim().split("\n").map(l => JSON.parse(l).id);
    assert.deepEqual(ids, [1, 2], `got replies ${ids}`);
  } finally { site.close(); }
});
