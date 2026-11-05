#!/usr/bin/env node
// The command the npm package installs (adr/0017). The site install runs search.mjs and mcp.mjs directly and never loads this.
import { argv } from "node:process";
import { readFileSync } from "node:fs";

const USAGE = `Search mothermachine.ai, a directory of software an agent can adapt or operate.

  npx mothermachine "invoicing for a freelancer"     ranked matches
  npx mothermachine "replace zendesk" --open         only open source
  npx mothermachine "crm" --interface mcp --limit 5  only software an agent drives over MCP
  npx mothermachine --detail usememos--memos         one full record
  npx mothermachine --vocab                          every filter value
  npx mothermachine mcp                              run the MCP server over stdio
`;

const args = argv.slice(2);
if (!args.length || args[0] === "--help" || args[0] === "-h") console.log(USAGE);
else if (args[0] === "--version" || args[0] === "-v") console.log(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
else if (args[0] === "mcp") await import("./mcp.mjs");
else (await import("./search.mjs")).cli();
