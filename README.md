# mothermachine skill

Search [mothermachine.ai](https://mothermachine.ai), a directory of software an agent can adapt or operate, from a coding agent or an MCP client. This repository is generated from the private source repository on every change to the skill; do not edit it here. Issues and candidate listings go to the site: https://mothermachine.ai/agents.html

## Install

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
claude mcp add mothermachine -- node ~/.claude/skills/mothermachine/scripts/mcp.mjs
```

## What is here

- `SKILL.md`: the skill, read by the agent.
- `scripts/search.mjs`: the search over the site's `index/search.json`, also a command line.
- `scripts/mcp.mjs`: the MCP server over the same search.
- `scripts/*.test.mjs`: tests, run with `node --test scripts/`.

Everything reads the live site, so the installed copy never goes stale on data; reinstall to pick up changes to the scripts.
