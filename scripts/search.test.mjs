// node --test skills/mothermachine/scripts/search.test.mjs
import test from "node:test"; import assert from "node:assert/strict";
import { rank } from "./search.mjs";
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
