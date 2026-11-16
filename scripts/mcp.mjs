#!/usr/bin/env node
// MCP server for the mothermachine directory, over stdio. No dependencies; Node 18+.
//
//   node mcp.mjs                     serve; a client such as Claude Code or Claude Desktop spawns it
//   node mcp.mjs --base http://...   read a local copy of the site instead of https://mothermachine.ai
//
// Three read-only tools: search, listing, vocab. They are the skill's search.mjs behind a protocol, with the
// same rank() over the same index/search.json, so the skill and the server cannot disagree (adr/0009).
// The protocol is the MCP stdio transport: one JSON-RPC 2.0 message per line, requests answered by id,
// notifications ignored. Written out here rather than taken from an SDK so that one file installs from the site.
import { createInterface } from "node:readline";
import { stdin, stdout, argv } from "node:process";
import { rank, get, loadIndex, detailOf, alternativesPages, hint, nearest, submitPage, stacksFrom, fitting } from "./search.mjs";

const VERSION = "1.4.0";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const base = ((argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "") || "https://mothermachine.ai").replace(/\/$/, "");

const TOOLS = [
  { name: "search", description: "Search mothermachine.ai, a directory of software an agent can adapt (pull the source and configure it) or operate (drive it through an MCP server, API, CLI, or config). Give one thing the software must do, in a word or two (\"booking\", \"invoicing\"), the commercial product to replace (\"replace Calendly\"), or the kind of business the user runs (\"barbershop software\"). A need with two parts is two calls. Returns ranked listings with the repo, how much is yours to change, how an agent reaches it, the license, and links to the page and JSON record. A query that names a kind of business also returns its stack: the page that names the listing for each job that business needs and how the apps hand work to each other. With a filter set, each of its jobs says whether its listing fits the filter. Empty query with a filter lists a whole slice.",
    inputSchema: { type: "object", properties: {
      query: { type: "string", description: "One need in a word or two (\"booking\"), or a product name. Not the user's whole sentence. May be empty when a filter is set." },
      vertical: { type: "string", description: "Restrict to one vertical; vocab lists the values." },
      effort: { type: "string", enum: ["config-only", "light-edit", "fork-and-modify"], description: "How much work it is to make it yours." },
      operability: { type: "string", description: "How an agent drives it; vocab lists the values (native, official, wrapped, config, gui)." },
      operable: { type: "boolean", description: "Only listings an agent can operate through an interface." },
      adaptable: { type: "boolean", description: "Only listings whose source is public with a named surface to change." },
      interface: { type: "string", enum: ["mcp", "api", "cli", "sdk", "config", "gui"], description: "Only listings an agent drives through this interface kind. mcp also includes listings whose builder ships an MCP server beside another interface." },
      open: { type: "boolean", description: "Only open source listings by the site's rule: an open license, no source-available or Commons Clause terms, and no closed core." },
      limit: { type: "integer", minimum: 1, maximum: 25, description: "How many results; default 8." } },
      additionalProperties: false },
    annotations: { title: "Search mothermachine", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  { name: "listing", description: "The full record for one listing by slug (owner--name, as search returns it): description, use-when list, alternatives, gotchas, accounts needed, the repo with license and stars, editions with how to get each, the adaptable surface (env vars, config files, prompt files, effort), and the operable surface (interface, coverage, reach: what an agent can and cannot do), with confidence per field.",
    inputSchema: { type: "object", properties: { slug: { type: "string", description: "Listing slug such as calcom--cal.diy." } }, required: ["slug"], additionalProperties: false },
    annotations: { title: "Read a listing", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  { name: "vocab", description: "The controlled vocabulary the directory is classified with: every field, its values, what each value means, and how many listings carry it. Read it to pick valid filter values for search.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { title: "Directory vocabulary", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
];

const SLUG = /^[A-Za-z0-9._-]+$/;
const strip = ({ effortRank, score, matched, ...l }) => ({ ...l, score, matched, page: `${base}/${l.url}`, json: `${base}/apps/${l.slug}.json` });
async function run(name, a = {}) {
  if (name === "search") {
    const idx = await loadIndex(base);
    const filters = { vertical: a.vertical || null, effort: a.effort || null, operability: a.operability || null, operable: !!a.operable, adaptable: !!a.adaptable, interface: a.interface || null, open: !!a.open };
    const limit = Math.min(Math.max(Number(a.limit) || 8, 1), 25);
    const query = String(a.query || "");
    const all = rank(idx.listings, query, filters);
    const results = all.slice(0, limit).map(strip);
    // The compare page for a named product, when the site has one. One more small fetch, only on a product hit.
    let compare = [];
    if (results.some(r => r.product)) { try { compare = alternativesPages(results, query, (await get(base, "index/alternatives.json")).products).map(c => ({ ...c, page: `${base}/${c.page}` })); } catch { compare = []; } }
    const stacks = await stacksFrom(base, query, fitting(idx.listings, filters));
    // The same hint the CLI prints, as data: the nearest vertical with its count and the submit page, so the client
    // can say plainly that nothing cleared the bar instead of treating a thin list as the answer.
    const thin = all.length < 3 && query && !stacks.length;
    return { base, query, filters, searched: idx.count, count: results.length, stacks, compare, results,
      ...(thin ? { hint: `${all.length ? "Thin result: only " + all.length + " cleared the bar. " : "Nothing in the directory clears the bar. "}${hint(query, idx.listings, base)}`, nearest: nearest(query, idx.listings), submit: submitPage(base) } : {}) };
  }
  if (name === "listing") {
    if (!SLUG.test(String(a.slug || ""))) throw new Error("slug must be owner--name, letters, digits, dots, dashes and underscores only");
    const { listing } = await get(base, `apps/${a.slug}.json`);
    return detailOf(listing, base);
  }
  if (name === "vocab") return get(base, "index/vocab.json");
  throw Object.assign(new Error(`unknown tool ${name}`), { code: -32602 });
}

const reply = (id, result) => stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
const fail = (id, code, message) => stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");

async function handle(msg) {
  const { id, method, params = {} } = msg;
  if (id === undefined) return; // notification: nothing to answer
  try {
    if (method === "initialize") return reply(id, { protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0], capabilities: { tools: {} }, serverInfo: { name: "mothermachine", version: VERSION }, instructions: `Directory of software an agent can adapt or operate, read from ${base}. Search matches words against listing names, the products they replace, taglines and use-when lines; it does not understand sentences. You are the translator: reduce the user's need to the one or two things the software must do and run one short query for each ("booking", then "invoicing"). A message with two needs is two searches, not one. Set vertical when it is obvious (vocab lists the values), and when the top results still look off, search an empty query with that vertical to read the whole slice. A result with a hint says nothing cleared the bar: say so plainly, offer the nearest vertical and its count from nearest, and the submit page; do not present a weak match as the answer. Then call listing for the one or two that fit. When search returns a stack, the user named a kind of business: lead with the stack page. Pass interface: "mcp" when the user needs MCP and open: true when they say open source; the words alone do not filter. A listing's verdict says whether the curator verified the record; most are unverified.` });
    if (method === "ping") return reply(id, {});
    if (method === "tools/list") return reply(id, { tools: TOOLS });
    if (method === "tools/call") {
      if (!TOOLS.some(t => t.name === params.name)) return fail(id, -32602, `unknown tool ${params.name}`);
      try { const out = await run(params.name, params.arguments || {}); return reply(id, { content: [{ type: "text", text: JSON.stringify(out) }] }); }
      catch (e) { return reply(id, { content: [{ type: "text", text: e.status === 404 ? `not found: ${e.message}` : e.message }], isError: true }); }
    }
    return fail(id, -32601, `method not found: ${method}`);
  } catch (e) { return fail(id, -32603, e.message); }
}

// Requests still being answered when the client closes its end; exit only after they are written.
const pending = new Set();
createInterface({ input: stdin }).on("line", line => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return fail(null, -32700, "parse error"); }
  const p = handle(msg).finally(() => pending.delete(p)); pending.add(p);
});
stdin.on("end", () => Promise.allSettled([...pending]).then(() => process.exit(0)));
