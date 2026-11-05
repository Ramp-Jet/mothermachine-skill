#!/usr/bin/env node
// Search the mothermachine directory from the command line. No dependencies; Node 18+.
//
//   node search.mjs "invoicing for a freelancer"                 ranked matches, compact
//   node search.mjs "open source notion" --json                  same, as JSON
//   node search.mjs "crm" --vertical smb-ops-crm --effort config-only --operable --limit 5
//   node search.mjs "zendesk" --interface mcp --open             only MCP-driven, only open source
//   node search.mjs "" --vertical scheduling-staffing                 everything in one vertical
//   node search.mjs --detail usememos--memos                      the full record, trimmed to what matters
//   node search.mjs --vocab                                       fields, values and counts
//
// Reads index/search.json (one fetch, every listing with its useWhen and alternativeTo text). Falls back to
// index/all.json on older deployments. --base overrides the site, e.g. a local checkout served on a port.
import { argv as ARGV, exit } from "node:process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = ARGV.slice(2);
const BOOL = new Set(["json", "operable", "adaptable", "vocab", "open"]);
const flag = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") && !BOOL.has(n) ? args[i + 1] : true) : null; };
const base = (flag("base") || "https://mothermachine.ai").replace(/\/$/, "");
const query = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !BOOL.has(args[i - 1].slice(2)))).join(" ").trim();

const STOP = new Set(("a an the for to of and or with my our your i we is are be that this it in on at by from as app apps tool tools software something anything " +
  "open source opensource self hosted selfhosted free alternative alternatives like want need looking find agent agents use using can should could would " +
  "every each month week day replacement instead person people team teams set setup up code touching touch seat seats pay paying bonus create through without " +
  "ops small business company option options good best simple easy way thing things one someone able let lets get got run runs host hosting hostable hosted own " +
  "before there here how does build building built make making place into onto what which where who why already exists exist").split(" "));
// Two-letter words (do, is, my) never name a need, so they are not tokens at all.
const words = s => String(s || "").toLowerCase().replace(/[^a-z0-9+#. -]/g, " ").split(/[\s/,;:()\-]+/).filter(Boolean);
const tokens = s => words(s).filter(t => t.length > 2 && !STOP.has(t));
// A light stemmer: strip -ing, -ers, -er, then a plural. "es" comes off only after a sibilant, so "notes" stays "note"
// and never matches the word "not"; "invoices" becomes "invoice" and still finds "invoicing" by substring.
const stem = t => t.replace(/(ing|ers|er)$/, "").replace(/(ss|sh|ch|x|z)es$/, "$1").replace(/([^s])s$/, "$1");
// Interface words describe how, not what. Half the directory mentions them, so they count as a hint, never a subject.
const HINT = new Set(["api", "rest", "mcp", "cli", "sdk", "server", "docker", "webhook", "webhooks"]);
// "make" is a stop word and also a product. A stop word counts as a product only where a person names one: as the whole
// query, or beside a word for replacing it ("Make alternative", "alternative to Make", "replace Make").
const REPLACING = new Set(["alternative", "alternatives", "replace", "replacing", "replacement", "instead", "vs", "versus"]);
const queryTerms = (q, listings) => {
  const all = words(q);
  const names = new Set(listings.flatMap(l => [l.name, ...(l.alternativeTo || [])]).map(n => String(n).toLowerCase()));
  const named = all.filter((w, i) => w.length > 2 && STOP.has(w) && names.has(w) &&
    (all.length === 1 || REPLACING.has(all[i + 1]) || REPLACING.has(all[i - 1]) || (all[i - 1] === "to" && REPLACING.has(all[i - 2]))));
  return [...new Set([...tokens(q), ...named].map(stem))];
};
// Fields a query word can hit, with weight. The third item marks a product field: a hit there is the strongest
// evidence there is, so it must be an exact word ("quickbooks"), never a fragment ("manag" inside "Management").
const FIELDS = l => [
  [l.name, 5, true], [(l.alternativeTo || []).join(" "), 5, true], [l.tagline || l.summary, 3],
  [(l.useWhen || []).join(" "), 2], [l.vertical, 2], [l.shape, 1], [(l.accounts || []).join(" "), 1],
  [l.a2a ? "a2a" : "", 3],
];
// A query token hits a field when its stem is a word there, or (five letters or more) when it appears inside a word:
// "calendly" should find "Calendly-style", "booking" should find "bookings".
const hit = (t, text, ft) => ft.has(t) || (t.length >= 5 && String(text || "").toLowerCase().includes(t));
// A product field keeps its stop words, so that a query naming Make can find the word "Make" there.
const fieldWords = (text, isProduct) => new Set((isProduct ? words(text) : tokens(text)).map(stem));
// The words that make up a product's name: its tokens, or the name itself when every word of it is a stop word.
const nameWords = p => { const t = tokens(p); return (t.length ? t : words(p)).map(stem); };
// Words people use for a need that the records rarely use. They do not score; they name the vertical to browse
// when a search comes back empty or thin, because reading a vertical of 16 is cheaper than guessing.
export const VERTICAL_WORDS = {
  ecommerce: "shop store storefront cart checkout sell selling products catalog merchant orders",
  "notes-knowledge": "notes note wiki knowledge docs documentation memory journal",
  "invoicing-finance": "invoice invoices invoicing accounting bookkeeping ledger expenses budget finance payments billing",
  "support-bookkeeping": "support helpdesk tickets ticketing chat inbox customers",
  "scheduling-staffing": "booking bookings appointments calendar scheduling schedule shifts staff rota availability",
  "video-streaming": "video videos editing clips podcast stream streaming subtitles captions",
  "content-publishing": "blog newsletter publishing cms social posts marketing seo",
  "smb-ops-crm": "crm leads contacts pipeline deals projects tasks hr payroll employees",
  "agent-infrastructure": "workflow workflows automation runtime",
};
export function verticalFor(q) {
  const qt = new Set(tokens(q).map(stem));
  let best = null, n = 0;
  for (const [v, words] of Object.entries(VERTICAL_WORDS)) { const k = words.split(" ").map(stem).filter(w => qt.has(w)).length; if (k > n) { best = v; n = k; } }
  return best;
}

// "agent" and "to" are stop words, so the spelled-out protocol name would otherwise reduce to nothing and match everything.
// Beside A2A, an Agent Card is the protocol's; alone, the words stay plain because some finance products issue cards with that name.
const a2aQuery = q => { const s = String(q || "").replace(/\bagents?[-_ ]?(to|2)[-_ ]?agents?\b/gi, "a2a"); return /\ba2a\b/i.test(s) ? s.replace(/\bagent[- ]cards?\b/gi, " ") : s; };

// "Open source" in a title or an answer is stricter than an open license string: source-available and Commons Clause code
// sits in readable repos, and closedCore marks an open repo around a closed product. Same rule as isOpenSource in build-site.
const OPEN_LICENSE = /^(MIT|Apache-2\.0|(A|L)?GPL-[23]|BSD-|MPL-)/;
const CLOSED_LICENSE = /commons clause|source-available/i;
export const isOpen = l => l.openSource ?? (OPEN_LICENSE.test(l.license || "") && !CLOSED_LICENSE.test(l.license || "") && !l.closedCore);
const hasMcp = l => l.interfaceKind === "mcp" || Boolean(l.mcpServer);
const OP_RANK = { native: 0, official: 0, wrapped: 1, config: 2, gui: 3 };

export function rank(listings, q, filters = {}) {
  const qt = queryTerms(a2aQuery(q), listings);
  // Words that all fell away leave nothing to match. Listing everything would read as an answer, so only a filter,
  // or a query that was empty to begin with, asks for a whole slice.
  if (String(q || "").trim() && !qt.length && !Object.values(filters).some(Boolean)) return [];
  const subjects = qt.filter(t => !HINT.has(t)).length;
  // A word is rare when fewer than one listing in twenty carries it (six of the 129 listed in November 2026).
  const rare = Math.max(2, Math.floor(listings.length / 20));
  // Words that appear in many listings say little about which one the user means. Weight by rarity.
  const df = Object.fromEntries(qt.map(t => [t, listings.filter(l => FIELDS(l).some(([text, , isProduct]) => hit(t, text, fieldWords(text, isProduct)))).length]));
  const rarity = t => 1 / Math.log2(2 + (df[t] || 0));
  const out = [];
  for (const l of listings) {
    if (filters.vertical && l.vertical !== filters.vertical) continue;
    if (filters.effort && l.effort !== filters.effort) continue;
    if (filters.operability && l.operability !== filters.operability) continue;
    if (filters.operable && !(l.capabilities || []).includes("operable")) continue;
    if (filters.adaptable && !(l.capabilities || []).includes("adaptable")) continue;
    if (filters.interface && !(l.interfaceKind === filters.interface || (filters.interface === "mcp" && hasMcp(l)))) continue;
    if (filters.open && !isOpen(l)) continue;
    let score = 0; const hits = new Set(); const weight = {}; let product = false;
    for (const t of qt) {
      // A word scores by the best field it hits, plus a fifth of any other field: a product named once in alternativeTo
      // outranks the same word mentioned in passing in a tagline and a use-when line, and between two taglines that
      // both say it, the listing that says it again in its use-when lines edges ahead.
      let best = 0, sum = 0;
      for (const [text, w, isProduct] of FIELDS(l)) {
        const ft = fieldWords(text, isProduct);
        const exact = ft.has(t);
        if (exact || (!isProduct && hit(t, text, ft))) { const v = HINT.has(t) ? 1 : w; sum += v; best = Math.max(best, v); if (isProduct && exact) product = true; }
      }
      // The whole product name beats part of one: "jira" is all of Jira and a third of Jira Service Management.
      if (product && [l.name, ...(l.alternativeTo || [])].some(p => { const pt = nameWords(p); return pt.length === 1 && pt[0] === t; })) best += 1;
      best = best + 0.2 * (sum - best);
      // "mcp" in the query is a need for the interface, not for the word. A listing an agent drives over MCP, or whose
      // builder ships an MCP server beside its API, scores as if the word were a product name.
      if (t === "mcp" && hasMcp(l)) best = 5;
      if (best) { score += best * rarity(t); if (!HINT.has(t)) { hits.add(t); weight[t] = best; } }
    }
    if (!qt.length) score = 1;
    // One incidental common word is not a match. Two distinct words are, a product name is, and a single word is when
    // it is the whole question, or when it is rare in the directory and sits in the name or tagline: "booking" alone
    // finds the booking tools, "manager" finds nothing, and "sell" inside one use-when line does not drag a listing in.
    const lone = [...hits][0];
    const strong = hits.size >= 2 || product || (subjects <= 1 && hits.size === 1) || (hits.size === 1 && (df[lone] || 0) <= rare && weight[lone] >= 3);
    if (score > 0 && (strong || !qt.length)) out.push({ ...l, score: +score.toFixed(2), matched: [...hits], product });
  }
  // Ties: an interface an agent can drive beats screen control (CONTEXT.md sorts GUI last), then less effort, then name.
  return out.sort((a, b) => b.score - a.score || (OP_RANK[a.operability] ?? 4) - (OP_RANK[b.operability] ?? 4) || (a.effortRank ?? 9) - (b.effortRank ?? 9) || a.name.localeCompare(b.name));
}

// The products a query names that have a compare page, so the answer can link it.
export function alternativesPages(results, q, products) {
  const qt = new Set(queryTerms(q, results));
  const named = new Set();
  // The whole product name must be in the query: "jira" names Jira, not Jira Service Management.
  for (const r of results) if (r.product) for (const p of r.alternativeTo || []) { const pt = nameWords(p); if (pt.length && pt.every(t => qt.has(t))) named.add(p); }
  return (products || []).filter(p => p.page && named.has(p.product)).map(p => ({ product: p.product, page: p.page }));
}

export async function get(base, path) {
  const r = await fetch(`${base}/${path}`, { headers: { "accept": "application/json" } });
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${base}/${path}`), { status: r.status });
  return r.json();
}

export const EFFORT_RANK = { "config-only": 0, "light-edit": 1, "fork-and-modify": 2 };
// The search index with effortRank attached; falls back to index/all.json on older deployments.
export async function loadIndex(base) {
  let idx; try { idx = await get(base, "index/search.json"); } catch (e) { if (e.status !== 404) throw e; idx = await get(base, "index/all.json"); }
  return { count: idx.count, listings: idx.listings.map(l => ({ ...l, effortRank: EFFORT_RANK[l.effort] })) };
}
// The full record trimmed to what an adopter or agent decides on.
export function detailOf(l, base) {
  return { slug: l.slug, name: l.name, tagline: l.tagline, description: l.description, page: `${base}/${l.url}`, capabilities: l.capabilities, vertical: l.vertical, shape: l.shape,
    useWhen: l.useWhen, alternativeTo: l.alternativeTo, gotchas: l.gotchas, accounts: l.accounts,
    repo: l.repos?.[0] ? { url: l.repos[0].url, license: l.repos[0].license, stars: l.repos[0].stars, lastCommit: l.repos[0].lastCommit } : null,
    closedCore: l.closedCore ?? null,
    editions: (l.editions || []).map(e => ({ name: e.name, price: e.price, open: e.open, get: (e.distributions || []).map(d => d.command || d.image || d.url).filter(Boolean) })),
    adaptable: l.customization ? { effort: l.customization.effort, editCount: l.customization.editCount, summary: l.customization.summary, envVars: l.customization.envVars, configFiles: l.customization.configFiles, promptFiles: l.customization.promptFiles } : null,
    operable: l.interface ? { operability: l.operability, interface: l.interface, mcpServer: l.mcpServer ?? null, coverage: l.coverage, reach: l.reach, recommendedWrapper: l.recommendedWrapper } : null,
    a2a: l.a2a ?? null,
    // verdict is the curator's: approve, dispute, or unverified. Most records are unverified; say so when quoting them.
    verdict: l.research?.verdict ?? null,
    confidence: l.confidence, openQuestions: l.openQuestions, lastActivity: l.lastActivity };
}
export const licenseText = l => `${l.license || "Closed source"}${l.closedCore ? " · core closed" : ""}`;
export function line(l, base) {
  const caps = (l.capabilities || []).map(c => c[0].toUpperCase()).join("+");
  const yours = l.effort ? `${l.effort}${l.editCount != null ? ` (${l.editCount} to edit)` : ""}` : "–";
  const agent = l.operability ? `${l.operability}/${l.interfaceKind || "?"}${l.mcpServer && l.interfaceKind !== "mcp" ? "+mcp" : ""}${l.coverage ? ` ${l.coverage}` : ""}` : "–";
  return `${l.slug}\n  ${l.tagline || l.summary}\n  ${caps} · yours: ${yours} · agent: ${agent} · ${licenseText(l)}${l.a2a ? ` · A2A: ${l.a2a}` : ""}${l.paid ? " · paid edition" : ""}${(l.alternativeTo || []).length ? ` · alt to ${l.alternativeTo.join(", ")}` : ""}\n  ${base}/${l.url}  json: ${base}/apps/${l.slug}.json`;
}
// What to say when a search finds nothing or little: the vertical the words point at, if any.
export function hint(q) {
  const v = verticalFor(q);
  return v ? `Try the whole vertical: --vertical ${v} with an empty query.` : "Try fewer words, a vertical (--vocab lists them), or the name of the product to replace.";
}

async function main() {
  if (flag("vocab")) { const v = await get(base, "index/vocab.json"); for (const f of v.fields) console.log(`${f.name}: ${f.values.map(x => `${x.value} (${x.count})`).join(", ")}`); return; }
  if (flag("detail")) {
    const { listing: l } = await get(base, `apps/${flag("detail")}.json`);
    console.log(JSON.stringify(detailOf(l, base), null, flag("json") ? 0 : 2)); return;
  }
  const idx = await loadIndex(base);
  const listings = idx.listings;
  const filters = { vertical: flag("vertical"), effort: flag("effort"), operability: flag("operability"), operable: !!flag("operable"), adaptable: !!flag("adaptable"), interface: flag("interface"), open: !!flag("open") };
  const limit = Number(flag("limit") || 8);
  const all = rank(listings, query, filters);
  const res = all.slice(0, limit);
  // The compare page is the best single link for a named product. One more small fetch, only when a product was named.
  let compare = [];
  if (res.some(r => r.product)) { try { compare = alternativesPages(res, query, (await get(base, "index/alternatives.json")).products); } catch { compare = []; } }
  if (flag("json")) { console.log(JSON.stringify({ base, query, filters, count: res.length, compare: compare.map(c => ({ ...c, page: `${base}/${c.page}` })), results: res.map(({ effortRank, ...r }) => r) })); return; }
  if (!res.length) { console.log(`No matches for "${query}". ${hint(query)}`); return; }
  console.log(`${res.length} match${res.length === 1 ? "" : "es"} for "${query}" (${idx.count} listings searched)\n`);
  for (const l of res) console.log(line(l, base) + "\n");
  for (const c of compare) console.log(`Compare every ${c.product} alternative: ${base}/${c.page}`);
  if (all.length < 3 && query) console.log(`Thin result. ${hint(query)}`);
}
// Run main() only when this file is the command, not when imported by the tests. Compare real paths:
// a skills folder reached through a symlink (macOS /var is one) would otherwise never match.
const same = (a, b) => { try { return realpathSync(a) === realpathSync(b); } catch { return false; } };
export const cli = () => main().catch(e => { console.error(`mothermachine search failed: ${e.message}`); exit(1); });
if (ARGV[1] && same(ARGV[1], fileURLToPath(import.meta.url))) cli();
