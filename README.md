# mothermachine skill

Search [mothermachine.ai](https://mothermachine.ai), a directory of software an agent can adapt or operate, from a coding agent or an MCP client. This repository is generated from the private source repository on every change to the skill; do not edit it here. More for agents is on the site: https://mothermachine.ai/agents.html

## Try it

Ask your agent in your own words:

- "Is there an open source Calendly alternative I can self-host?"
- "Before I build this, what's out there for invoicing for a freelancer?"
- "Find a CRM my coding agent can drive over MCP."

Each answer gives the repo, the install command, how much is yours to change, and what an agent can and can't do with it.

## Run it

With Node 18 or later, nothing to install:

```sh
npx mothermachine "invoicing for a freelancer"
```

## Install the skill

With the skills CLI, into every agent it knows about:

```sh
npx skills add Ramp-Jet/mothermachine-skill
```

Or straight from the site, with no CLI, into Claude Code's skills folder:

```sh
for f in SKILL.md scripts/search.mjs scripts/mcp.mjs; do curl -fsSL --create-dirs -o ~/.claude/skills/mothermachine/$f https://mothermachine.ai/skills/mothermachine/$f; done
```

Then `/mothermachine <what you need>` searches the directory from the chat.

## MCP server

`scripts/mcp.mjs` is the same search as an MCP server over stdio, with three read-only tools: search, listing, vocab. No dependencies; Node 18 or later.

```sh
claude mcp add mothermachine -- npx -y mothermachine mcp
```

The [official MCP Registry](https://registry.modelcontextprotocol.io/) lists it as `io.github.Ramp-Jet/mothermachine`.

If you installed the skill, the server is already on disk:

```sh
claude mcp add mothermachine -- node ~/.claude/skills/mothermachine/scripts/mcp.mjs
```

## What it fetches

The skill and the MCP server read the search index and other public JSON files from https://mothermachine.ai. The search runs on your machine, so your search words are not sent. Those requests reach the site's host like any page visit, which the [privacy page](https://mothermachine.ai/privacy.html) covers. Neither one writes files or sends telemetry. They run only the scripts in this repository, with Node 18 or later.

## If something goes wrong

- `mothermachine search failed: fetch failed` means the site could not be reached. Check that your machine or sandbox allows network access to mothermachine.ai.
- A script that will not start usually means an older Node. Run `node --version`; it needs Node 18 or later.
- No matches? Try fewer words, or the name of the product you want to replace. `--vocab` lists every filter value.
- MCP tools missing? Restart the client, then check that it lists the `mothermachine` server.

## Support and security

Report a problem at https://github.com/Ramp-Jet/mothermachine-skill/issues. Send security reports privately to privacy@rampjet.ai.

## What is here

- `SKILL.md`: the skill, read by the agent.
- `scripts/search.mjs`: the search over the site's `index/search.json`, also a command line.
- `scripts/mcp.mjs`: the MCP server over the same search.
- `scripts/cli.mjs` and `package.json`: the `mothermachine` command on npm, which runs the two scripts above.
- `scripts/*.test.mjs`: tests, run with `node --test`.
- `plugin/`: the Claude plugin for Anthropic's directory. Its `SKILL.md` runs no script and reads the site's JSON directly, because the directory takes code only from Verified organizations. The skill above is the full one.
- `server.json`: the listing on the MCP Registry.
- `.github/workflows/`: `release.yml` publishes a new version to npm, and `mcp-registry.yml` lists it on the MCP Registry.
- `LICENSE`: MIT, the same as the source repository.

Everything reads the live site, so an installed copy never goes stale on data; reinstall to pick up changes to the scripts.
