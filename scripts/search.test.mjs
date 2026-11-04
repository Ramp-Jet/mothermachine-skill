// node --test skills/mothermachine/scripts/search.test.mjs
import test from "node:test"; import assert from "node:assert/strict";
import { rank, detailOf, line } from "./search.mjs";
// The newer exports come through the namespace so that, before they exist, each test fails on its own behavior.
import * as S from "./search.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const L = [
  { slug: "a--notes", name: "Notely", tagline: "Self-hosted note taking", useWhen: ["I keep notes in markdown"], alternativeTo: ["Notion"], vertical: "notes-knowledge", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", paid: false },
  { slug: "b--books", name: "Ledgerly", tagline: "Double-entry accounting for freelancers", useWhen: ["I invoice clients monthly"], alternativeTo: ["QuickBooks"], vertical: "invoicing-finance", capabilities: ["adaptable"], effort: "light-edit", operability: null, paid: true },
  { slug: "c--crm", name: "Dealflow", tagline: "CRM for small teams", useWhen: [], alternativeTo: ["HubSpot"], vertical: "smb-ops-crm", capabilities: ["operable"], effort: null, operability: "native", paid: false },
];
test("alternative-to names outrank incidental words", () => { assert.equal(rank(L, "open source notion")[0].slug, "a--notes"); assert.equal(rank(L, "quickbooks replacement")[0].slug, "b--books"); });
test("use-when phrases match a need in the user's words", () => { assert.equal(rank(L, "I need to invoice my clients")[0].slug, "b--books"); });
test("filters narrow before ranking", () => {
  assert.deepEqual(rank(L, "", { operable: true }).map(l => l.slug).sort(), ["a--notes", "c--crm"]);
  assert.deepEqual(rank(L, "", { effort: "config-only" }).map(l => l.slug), ["a--notes"]);
  assert.deepEqual(rank(L, "", { vertical: "smb-ops-crm" }).map(l => l.slug), ["c--crm"]);
});
test("no match returns empty rather than everything", () => { assert.deepEqual(rank(L, "kubernetes operator"), []); });
test("a single incidental word is below the threshold", () => {
  const L2 = [{ slug: "x--chat", name: "Chatter", tagline: "Live chat platform", useWhen: ["basic auth with an operator key"], alternativeTo: [], vertical: "support-bookkeeping", capabilities: ["operable"], paid: false }];
  assert.deepEqual(rank(L2, "kubernetes operator for rocket telemetry"), []);
  assert.equal(rank(L2, "live chat")[0].slug, "x--chat", "two matched words still rank");
});
test("interface words are hints, not subjects", () => {
  const L3 = [
    { slug: "s--shop", name: "Shoply", tagline: "Ecommerce with a REST API and MCP server", useWhen: ["I run a store and want an api"], alternativeTo: [], vertical: "ecommerce", capabilities: ["operable"], paid: false },
    { slug: "h--desk", name: "Deskly", tagline: "Helpdesk and ticketing", useWhen: ["my support inbox is a mess"], alternativeTo: [], vertical: "support-bookkeeping", capabilities: ["operable"], paid: false },
  ];
  const r = rank(L3, "helpdesk with an api my agent can use");
  assert.equal(r[0].slug, "h--desk");
  assert.ok(!r.some(x => x.slug === "s--shop"), "api alone does not make a match");
});
test("a long request in the user's words ranks the named product and the subject above generic overlap", () => {
  const V = [
    { slug: "k--time", name: "Kimai", tagline: "Self-hosted time tracking for teams", useWhen: ["my team logs hours", "open source timesheets"], alternativeTo: [], vertical: "scheduling-staffing", capabilities: ["adaptable", "operable"], paid: true },
    { slug: "g--gauzy", name: "Gauzy", tagline: "Open source business management platform for teams", useWhen: ["agency ops in one place"], alternativeTo: [], vertical: "scheduling-staffing", capabilities: ["adaptable", "operable"], paid: true },
    { slug: "c--caldiy", name: "Cal.diy", tagline: "Scheduling infrastructure, MIT edition", useWhen: ["I want a Calendly-style booking page I own"], alternativeTo: [], vertical: "scheduling-staffing", capabilities: ["adaptable", "operable"], paid: true },
    { slug: "e--easy", name: "Easy!Appointments", tagline: "Self-hosted appointment booking for several providers with a REST API", useWhen: ["my agent checks availability and books clients"], alternativeTo: [], vertical: "scheduling-staffing", capabilities: ["adaptable", "operable"], paid: false },
  ];
  const r = rank(V, "we're paying for Calendly team seats, something open source to self-host that our ops person could set up without touching code, bonus if our agent can create bookings");
  assert.deepEqual(r.slice(0, 2).map(x => x.slug).sort(), ["c--caldiy", "e--easy"], JSON.stringify(r.map(x => [x.slug, x.score, x.matched])));
  assert.equal(rank(V, "calendly")[0].slug, "c--caldiy", "hyphenated Calendly-style must match");
});

test("the script runs as a command when invoked through a symlinked path, as a skills folder under a symlink is", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-skill-"));
  const link = path.join(dir, "linked");
  fs.symlinkSync(path.dirname(fileURLToPath(import.meta.url)), link);
  // An unreachable base makes main() fail fast and loudly; with a broken guard main() never runs and nothing is printed.
  const r = spawnSync(process.execPath, [path.join(link, "search.mjs"), "invoice", "--base", "http://127.0.0.1:9"], { encoding: "utf8", timeout: 20000 });
  assert.equal(r.status, 1, `expected the search to run and fail on the unreachable base; stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(r.stderr)}`);
  assert.match(r.stderr, /mothermachine search failed/);
});
test("A2A words find listings that record A2A support, and no others", () => {
  const withA2a = [...L, { slug: "d--gateway", name: "Portly", tagline: "A gateway for paid APIs", useWhen: [], alternativeTo: [], vertical: "ecommerce", capabilities: ["operable"], effort: null, operability: "official", coverage: "partial", interfaceKind: "mcp", a2a: "server" }];
  assert.deepEqual(rank(withA2a, "a2a").map(r => r.slug), ["d--gateway"]);
  assert.equal(rank(withA2a, "agent2agent")[0]?.slug, "d--gateway");
  assert.deepEqual(rank(L, "a2a"), []);
});
test("the headline phrase finds A2A listings instead of every listing", () => {
  const withA2a = [...L, { slug: "d--gateway", name: "Portly", tagline: "A gateway for paid APIs", useWhen: [], alternativeTo: [], vertical: "ecommerce", capabilities: ["operable"], a2a: "server" }];
  for (const q of ["agent-to-agent", "agent to agent", "agents to agents", "agent_to_agent", "agent to agent software", "Agent2Agent"]) assert.deepEqual(rank(withA2a, q).map(r => r.slug), ["d--gateway"], q);
});
test("with A2A in the query, an Agent Card means the protocol's, not a payment card", () => {
  const cards = [{ slug: "e--pay", name: "Payly", tagline: "Spend management with agent cards", useWhen: ["I issue a card"], alternativeTo: [], vertical: "invoicing-finance", capabilities: ["operable"], a2a: null },
    { slug: "d--gateway", name: "Portly", tagline: "A gateway for paid APIs", useWhen: [], alternativeTo: [], vertical: "ecommerce", capabilities: ["operable"], a2a: "server" }];
  assert.equal(rank(cards, "a2a agent card")[0].slug, "d--gateway");
  assert.deepEqual(rank(cards, "agent card").map(r => r.slug), ["e--pay"], "without A2A the words keep their plain meaning");
});
test("the detail view and the result line carry A2A support", () => {
  const a2a = { role: "server", status: "experimental", protocolVersion: "1.0", bindings: ["JSONRPC"], agentCard: null, cardPath: "/.well-known/agent-card.json", url: "https://acme.example/a2a", official: true, evidence: "seen" };
  assert.deepEqual(detailOf({ slug: "d", url: "apps/d.html", a2a }, "https://x").a2a, a2a);
  assert.equal(detailOf({ slug: "d", url: "apps/d.html" }, "https://x").a2a, null);
  assert.match(line({ slug: "d", url: "apps/d.html", tagline: "t", capabilities: ["operable"], a2a: "server" }, "https://x"), /A2A: server/);
  assert.doesNotMatch(line({ slug: "d", url: "apps/d.html", tagline: "t", capabilities: ["operable"], a2a: null }, "https://x"), /A2A/);
});

// Cases below came from running the live index on November 4, 2026 (PR evidence has the before and after output).
const LIVE = [
  { slug: "clawbolt", name: "Clawbolt", tagline: "Messaging-first assistant for tradespeople: estimates, QuickBooks invoices and calendar from a text thread", useWhen: ["I want QuickBooks invoices sent from a text thread"], alternativeTo: ["Jobber", "Housecall Pro"], vertical: "invoicing-finance", capabilities: ["adaptable"], effort: "config-only", operability: null, interfaceKind: null, license: "Apache-2.0", paid: false },
  { slug: "ninja", name: "Invoice Ninja", tagline: "Self-hostable invoicing, quotes, expenses and time tracking with a complete REST API", useWhen: ["I bill clients and want a REST API"], alternativeTo: ["FreshBooks", "QuickBooks", "Zoho Invoice"], vertical: "invoicing-finance", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "api", license: "Elastic-2.0", paid: true },
  { slug: "chatwoot", name: "Chatwoot", tagline: "Omnichannel support desk with documented APIs", useWhen: ["I am leaving Zendesk and want my agent on the Application API"], alternativeTo: ["Intercom", "Zendesk", "Freshdesk"], vertical: "support-bookkeeping", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "api", license: "MIT", paid: false },
  { slug: "rt", name: "RT", tagline: "Enterprise ticket tracker with a Builder-shipped MCP server", useWhen: [], alternativeTo: ["Zendesk", "Jira Service Management"], vertical: "support-bookkeeping", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "mcp", license: "GPL-2.0", paid: true },
  { slug: "postiz", name: "Postiz", tagline: "Self-hosted social scheduler with a public API and an in-repo MCP server", useWhen: [], alternativeTo: ["Buffer"], vertical: "content-publishing", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "api", mcpServer: true, license: "AGPL-3.0", paid: true },
  { slug: "glpi", name: "GLPI", tagline: "ITIL service desk and asset manager with a REST API", useWhen: [], alternativeTo: ["ServiceNow", "Jira Service Management"], vertical: "support-bookkeeping", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "api", license: "GPL-3.0", paid: false },
  { slug: "plane", name: "Plane", tagline: "Open-source project management with the Builder's own MCP server", useWhen: [], alternativeTo: ["Jira", "Linear", "Asana"], vertical: "smb-ops-crm", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "mcp", license: "AGPL-3.0", paid: false },
  { slug: "agentdesk", name: "Agent Desk", tagline: "AI help desk with tickets", useWhen: [], alternativeTo: ["Intercom", "Zendesk"], vertical: "support-bookkeeping", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "gui", interfaceKind: "gui", license: "Apache-2.0", paid: false },
  { slug: "writefreely", name: "WriteFreely", tagline: "Minimalist federated blogging server", useWhen: ["I publish essays"], alternativeTo: ["Medium"], vertical: "content-publishing", capabilities: ["operable"], effort: null, operability: "official", interfaceKind: "api", license: "AGPL-3.0", paid: false },
  { slug: "joplin", name: "Joplin", tagline: "Open-source notes app with an in-app MCP server", useWhen: ["my agent reads and writes my notes"], alternativeTo: ["Evernote"], vertical: "notes-knowledge", capabilities: ["operable"], effort: null, operability: "official", interfaceKind: "mcp", license: "AGPL-3.0-or-later", paid: true },
  { slug: "outline", name: "Outline", tagline: "Team knowledge base and wiki with a REST API", useWhen: [], alternativeTo: ["Notion", "Confluence"], vertical: "notes-knowledge", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "mcp", license: "BUSL-1.1", paid: true },
  { slug: "bookstack", name: "BookStack", tagline: "Documentation wiki with a token REST API", useWhen: [], alternativeTo: ["Confluence", "Notion"], vertical: "notes-knowledge", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "api", license: "MIT", paid: false },
  { slug: "firefly", name: "Firefly III", tagline: "Self-hosted personal finance manager with a REST API", useWhen: [], alternativeTo: ["YNAB"], vertical: "invoicing-finance", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "api", license: "AGPL-3.0", paid: false },
  { slug: "brightbean", name: "BrightBean", tagline: "Social media manager for agencies with an in-repo MCP app", useWhen: [], alternativeTo: ["Buffer"], vertical: "content-publishing", capabilities: ["adaptable", "operable"], effort: "config-only", operability: "official", interfaceKind: "mcp", license: "AGPL-3.0", paid: false },
  { slug: "sanity", name: "Sanity", tagline: "Hosted structured-content backend with an open-source Studio", useWhen: [], alternativeTo: ["Contentful"], vertical: "content-publishing", capabilities: ["adaptable", "operable"], effort: "light-edit", operability: "official", interfaceKind: "mcp", license: "MIT", closedCore: "Content Lake is hosted and closed", paid: true },
];
test("a product named in alternativeTo outranks the same word mentioned in passing", () => {
  assert.equal(rank(LIVE, "quickbooks replacement for a small business")[0].slug, "ninja");
});
test("a lone common word in a tagline or name is not a match", () => {
  assert.deepEqual(rank(LIVE, "self-hosted password manager"), [], "manager alone does not find the asset manager");
  assert.deepEqual(rank(LIVE, "how do I write a recursive fibonacci in python"), [], "write does not find WriteFreely by its name");
});
test("notes stays notes: the stemmer never turns a plural into another word", () => {
  const r = rank(LIVE, "a place for my notes that my agent can read and write");
  assert.equal(r[0].slug, "joplin", JSON.stringify(r.map(x => [x.slug, x.matched])));
  assert.ok(!r.some(x => x.slug === "writefreely"), "nothing about notes points at a blogging server");
});
test("mcp in the query ranks MCP-driven listings first, including a builder MCP beside an API", () => {
  const r = rank(LIVE, "open source zendesk alternative with mcp");
  assert.equal(r[0].slug, "rt", JSON.stringify(r.map(x => [x.slug, x.score])));
  assert.ok(r.findIndex(x => x.slug === "chatwoot") > r.findIndex(x => x.slug === "rt"));
  assert.equal(rank(LIVE, "social scheduler with mcp")[0].slug, "postiz", "mcpServer counts as MCP");
});
test("--interface mcp honors mcpServer, --open applies the site's open source rule", () => {
  assert.deepEqual(rank(LIVE, "", { interface: "mcp" }).map(x => x.slug).sort(), ["brightbean", "joplin", "outline", "plane", "postiz", "rt", "sanity"]);
  assert.deepEqual(rank(LIVE, "notion wiki", { open: true }).map(x => x.slug), ["bookstack"], "BUSL is not open source");
  assert.equal(S.isOpen({ license: "MIT", closedCore: "the backend" }), false, "an open repo around a closed product is not open source");
  assert.equal(S.isOpen({ license: "MIT with Commons Clause" }), false);
  assert.equal(S.isOpen({ license: "AGPL-3.0", openSource: true }), true, "the index flag wins when the build provides it");
});
test("ties break on operability: screen control sorts last", () => {
  const r = rank(LIVE, "open source zendesk alternative");
  assert.equal(r.at(-1).slug, "agentdesk", JSON.stringify(r.map(x => [x.slug, x.score])));
});
test("jira names Jira, so Plane leads Jira Service Management tools and the compare link is Jira's", () => {
  const r = rank(LIVE, "jira alternative for sprint planning");
  assert.equal(r[0].slug, "plane");
  const products = [{ product: "Jira", page: "alternatives/jira.html" }, { product: "Jira Service Management", page: "alternatives/jira-service-management.html" }, { product: "Zendesk", page: null }];
  assert.deepEqual(S.alternativesPages(r, "jira alternative for sprint planning", products), [{ product: "Jira", page: "alternatives/jira.html" }]);
  assert.deepEqual(S.alternativesPages(rank(LIVE, "zendesk"), "zendesk", products), [], "a product without a page gets no link");
});
test("a thin or empty search names the vertical the words point at", () => {
  assert.equal(S.verticalFor("sell t-shirts online"), "ecommerce");
  assert.equal(S.verticalFor("kubernetes operator"), null);
  assert.match(S.hint("sell t-shirts online"), /--vertical ecommerce/);
  assert.match(S.hint("kubernetes operator"), /fewer words/);
});
test("the result line says closed source and core closed, and the detail carries closedCore, mcpServer and the verdict", () => {
  assert.match(line({ slug: "z", url: "apps/z.html", tagline: "t", capabilities: ["operable"], license: null }, "https://x"), /Closed source/);
  assert.match(line(LIVE.find(l => l.slug === "sanity"), "https://x"), /MIT · core closed/);
  assert.match(line(LIVE.find(l => l.slug === "postiz"), "https://x"), /official\/api\+mcp/);
  const d = detailOf({ slug: "s", url: "apps/s.html", closedCore: "the backend", interface: { kind: "api" }, mcpServer: { url: "https://m" }, research: { verdict: "dispute" } }, "https://x");
  assert.equal(d.closedCore, "the backend"); assert.deepEqual(d.operable.mcpServer, { url: "https://m" }); assert.equal(d.verdict, "dispute");
  assert.equal(detailOf({ slug: "s", url: "apps/s.html" }, "https://x").verdict, null);
});
test("a query of only stop words finds nothing, unless a filter says what to list", () => {
  for (const q of ["is there one already", "what can I build", "best one to run", "alternative"]) assert.deepEqual(rank(L, q), [], q);
  assert.deepEqual(rank(L, "open source", { vertical: "smb-ops-crm" }).map(l => l.slug), ["c--crm"], "the words add nothing, the filter still lists its slice");
  assert.equal(rank(L, "").length, L.length, "an empty query is a request for the whole list");
});
test("Make the product is found where a person names a product; make the verb stays a stop word", () => {
  const flows = { slug: "m--flows", name: "Flowly", tagline: "Visual automation", useWhen: [], alternativeTo: ["Zapier", "Make"], vertical: "agent-infrastructure", capabilities: ["adaptable"], effort: "config-only", effortRank: 0, operability: null };
  const M = [...L, flows];
  for (const q of ["Make alternative", "make", "alternative to Make", "replace make", "zapier or make alternative"]) assert.equal(rank(M, q)[0]?.slug, "m--flows", q);
  assert.deepEqual(rank(M, "what can I make"), []);
  assert.ok(!rank(M, "make a wiki for my notes").some(l => l.slug === "m--flows"), "the verb does not name the product");
  assert.ok(!rank(M, "make an alternative to notion").some(l => l.slug === "m--flows"), "nor does it when an alternative is what gets made");
  const pages = S.alternativesPages(rank(M, "Make alternative"), "Make alternative", [{ product: "Make", page: "alternatives/make.html" }]);
  assert.deepEqual(pages.map(p => p.product), ["Make"], "the compare link follows the same rule");
});
test("a short word in a product name does not cost it the whole-name match", () => {
  const F = [{ slug: "f--desk", name: "Frappe Helpdesk", tagline: "Tickets", useWhen: [], alternativeTo: [], vertical: "support-bookkeeping", capabilities: ["adaptable"], effort: "config-only", effortRank: 0 },
    { slug: "f--hr", name: "Frappe HR", tagline: "Leave and payroll", useWhen: [], alternativeTo: [], vertical: "smb-ops-crm", capabilities: ["adaptable"], effort: "config-only", effortRank: 0 }];
  assert.equal(rank(F, "Frappe HR")[0].slug, "f--hr");
});
