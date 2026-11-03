#!/usr/bin/env node
// Search the mothermachine directory from the command line. No dependencies; Node 18+.
//
//   node search.mjs "invoicing for a freelancer"                 ranked matches, compact
//   node search.mjs "open source notion" --json                  same, as JSON
//   node search.mjs "crm" --vertical smb-ops-crm --effort config-only --operable --limit 5
//   node search.mjs "" --vertical scheduling-staffing                 everything in one vertical
//   node search.mjs --detail usememos--memos                      the full record, trimmed to what matters
//   node search.mjs --vocab                                       fields, values and counts
//
// Reads index/search.json (one fetch, every listing with its useWhen and alternativeTo text). Falls back to
// index/all.json on older deployments. --base overrides the site, e.g. a local checkout served on a port.
import { argv as ARGV, exit, env } from "node:process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = ARGV.slice(2);
const flag = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : null; };
const base = (flag("base") || env.MOTHERMACHINE_BASE || "https://mothermachine.ai").replace(/\/$/, "");
const query = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["json", "operable", "adaptable", "vocab"].includes(args[i - 1].slice(2)))).join(" ").trim();

const STOP = new Set(("a an the for to of and or with my our your i we is are be that this it in on at by from as app apps tool tools software something anything " +
  "open source opensource self hosted selfhosted free alternative alternatives like want need looking find agent agents use using can should could would " +
  "every each month week day replacement instead person people team teams set setup up code touching touch seat seats pay paying bonus create through without " +
  "ops small business company option options good best simple easy way thing things one someone able let lets get got run runs host hosting hostable hosted own").split(" "));
const tokens = s => String(s || "").toLowerCase().replace(/[^a-z0-9+#. -]/g, " ").split(/[\s/,;:()\-]+/).filter(t => t.length > 1 && !STOP.has(t));
const stem = t => t.replace(/(ing|ers|er|es|s)$/, "");
// Interface words describe how, not what. Half the directory mentions them, so they count as a hint, never a subject.
const HINT = new Set(["api", "rest", "mcp", "cli", "sdk", "server", "docker", "webhook", "webhooks"]);
const FIELDS = l => [
  [l.name, 5], [(l.alternativeTo || []).join(" "), 5], [l.slug, 3], [l.tagline || l.summary, 3],
  [(l.useWhen || []).join(" "), 2], [l.vertical, 2], [l.shape, 1], [(l.accounts || []).join(" "), 1],
];
// A query token hits a field when its stem is a word there, or (five letters or more) when it appears inside a word:
// "calendly" should find "Calendly-style", "booking" should find "bookings".
const hit = (t, text, ft) => ft.has(t) || (t.length >= 5 && String(text || "").toLowerCase().includes(t));

export function rank(listings, q, filters = {}) {
  const qt = [...new Set(tokens(q).map(stem))];
  // Words that appear in many listings say little about which one the user means. Weight by rarity.
  const df = Object.fromEntries(qt.map(t => [t, listings.filter(l => FIELDS(l).some(([text]) => hit(t, text, new Set(tokens(text).map(stem))))).length]));
  const rarity = t => 1 / Math.log2(2 + (df[t] || 0));
  const out = [];
  for (const l of listings) {
    if (filters.vertical && l.vertical !== filters.vertical) continue;
    if (filters.effort && l.effort !== filters.effort) continue;
    if (filters.operability && l.operability !== filters.operability) continue;
    if (filters.operable && !(l.capabilities || []).includes("operable")) continue;
    if (filters.adaptable && !(l.capabilities || []).includes("adaptable")) continue;
    let score = 0, raw = 0; const hits = new Set();
    for (const [text, w] of FIELDS(l)) {
      const ft = new Set(tokens(text).map(stem));
      for (const t of qt) if (hit(t, text, ft)) { score += (HINT.has(t) ? 1 : w) * rarity(t); if (!HINT.has(t)) { raw += w; hits.add(t); } }
    }
    if (!qt.length) score = 1;
    // One incidental common word is not a match. Two distinct words are, a strong field (name, product, tagline) is,
    // and so is a single rare word: a product name that appears in one or two listings is the best signal there is.
    // A lone hit in a weak field (use-when text) qualifies only when the user typed just that word, so "calendly"
    // finds "Calendly-style" but a stray "operator" inside a long sentence does not drag a listing in.
    const strong = hits.size >= 2 || raw >= 3 || (qt.length === 1 && hits.size === 1);
    if (score > 0 && (strong || !qt.length)) out.push({ ...l, score: +score.toFixed(2), matched: [...hits] });
  }
  return out.sort((a, b) => b.score - a.score || (a.effortRank ?? 9) - (b.effortRank ?? 9) || a.name.localeCompare(b.name));
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
    editions: (l.editions || []).map(e => ({ name: e.name, price: e.price, open: e.open, get: (e.distributions || []).map(d => d.command || d.image || d.url).filter(Boolean) })),
    adaptable: l.customization ? { effort: l.customization.effort, editCount: l.customization.editCount, summary: l.customization.summary, envVars: l.customization.envVars, configFiles: l.customization.configFiles, promptFiles: l.customization.promptFiles } : null,
    operable: l.interface ? { operability: l.operability, interface: l.interface, coverage: l.coverage, reach: l.reach, recommendedWrapper: l.recommendedWrapper } : null,
    confidence: l.confidence, openQuestions: l.openQuestions, lastActivity: l.lastActivity };
}
export function line(l, base) {
  const caps = (l.capabilities || []).map(c => c[0].toUpperCase()).join("+");
  const yours = l.effort ? `${l.effort}${l.editCount != null ? ` (${l.editCount} to edit)` : ""}` : "–";
  const agent = l.operability ? `${l.operability}/${l.interfaceKind || "?"}${l.coverage ? ` ${l.coverage}` : ""}` : "–";
  return `${l.slug}\n  ${l.tagline || l.summary}\n  ${caps} · yours: ${yours} · agent: ${agent} · ${l.license || "no licence"}${l.paid ? " · paid edition" : ""}${(l.alternativeTo || []).length ? ` · alt to ${l.alternativeTo.join(", ")}` : ""}\n  ${base}/${l.url}  json: ${base}/apps/${l.slug}.json`;
}

async function main() {
  if (flag("vocab")) { const v = await get(base, "index/vocab.json"); for (const f of v.fields) console.log(`${f.name}: ${f.values.map(x => `${x.value} (${x.count})`).join(", ")}`); return; }
  if (flag("detail")) {
    const { listing: l } = await get(base, `apps/${flag("detail")}.json`);
    console.log(JSON.stringify(detailOf(l, base), null, flag("json") ? 0 : 2)); return;
  }
  const idx = await loadIndex(base);
  const listings = idx.listings;
  const filters = { vertical: flag("vertical"), effort: flag("effort"), operability: flag("operability"), operable: !!flag("operable"), adaptable: !!flag("adaptable") };
  const limit = Number(flag("limit") || 8);
  const res = rank(listings, query, filters).slice(0, limit);
  if (flag("json")) { console.log(JSON.stringify({ base, query, filters, count: res.length, results: res.map(({ effortRank, ...r }) => r) })); return; }
  if (!res.length) { console.log(`No matches for "${query}". Try fewer words, a vertical (--vocab lists them), or an alternative-to name.`); return; }
  console.log(`${res.length} match${res.length === 1 ? "" : "es"} for "${query}" (${idx.count} listings searched)\n`);
  for (const l of res) console.log(line(l, base) + "\n");
}
// Run main() only when this file is the command, not when imported by the tests. Compare real paths:
// a skills folder reached through a symlink (macOS /var is one) would otherwise never match.
const same = (a, b) => { try { return realpathSync(a) === realpathSync(b); } catch { return false; } };
if (ARGV[1] && same(ARGV[1], fileURLToPath(import.meta.url))) main().catch(e => { console.error(`mothermachine search failed: ${e.message}`); exit(1); });
