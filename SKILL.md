---
name: mothermachine
description: Search mothermachine.ai, a directory of software an agent can adapt or operate, and bring the answer back into the chat with the repo, the install command, how much is yours to change, and what an agent can and cannot do with it. Use this whenever the user types /mothermachine, asks whether something already exists that does X, wants an open-source or self-hosted alternative to a named product (Notion, Zapier, Calendly, QuickBooks, Shopify), asks what they could pull down and configure instead of building or subscribing, or wants software their coding agent can drive through an MCP server, API, or CLI. Reach for it even when they do not say "mothermachine": "is there an app for", "something I can self-host for", "before I build this", and "what's out there for" are all this skill.
compatibility: Needs network access to mothermachine.ai and Node 18 or later for the bundled script. Without Node, follow the manual fetch steps.
---

# mothermachine

mothermachine.ai lists software that a person or their agent can take and use: pull the source and configure it (Adaptable), drive it through an interface (Operable), or both. Every listing is published as plain JSON with the same vocabulary the site uses, so the whole search happens in two or three small fetches and the answer comes back into the chat. The user never has to open the site.

## What the user wants back

A short, decisive answer, not a catalog. Usually one to three candidates, each with enough to act on:

- Name, one line on what it does, and the page link.
- Which capability it is. Adaptable comes with an effort grade and a count of things to edit. Operable comes with an operability level, the interface kind, and reach coverage. State both when both apply.
- How to get it: the clone, install, pull, or deploy command from its editions.
- License, and whether a paid edition exists. Every listing has a free or open edition by the site's rules; `paid: true` means a priced edition also exists, often with the team features. Say which features sit behind it when the record does.
- Gotchas and accounts needed, before the user starts. A copyleft license, an unsigned Mac build, or a Twilio account is exactly what they want to know now rather than an hour in.
- Where the record is uncertain, say so. Every classified field carries confidence; `openQuestions` lists what the curator could not settle.

If nothing fits, say that plainly and suggest the nearest vertical, or the Candidate issue form on the site if the user knows of something that belongs there.

## Procedure

1. Run the bundled script by its full path (this skill's directory plus `scripts/search.mjs`; it does not need a particular working directory). It fetches `index/search.json` once, ranks the user's words against names, alternative-to products, taglines and the listings' own "use it when" phrases, weighting rare words over common ones, and prints compact results with links.

   ```
   node <skill-dir>/scripts/search.mjs "<the user's need in their words>" [--vertical v] [--effort e] [--operable] [--adaptable] [--limit n]
   ```

   Verticals: content-publishing, ecommerce, notes-knowledge, invoicing-finance, smb-ops-crm, support-bookkeeping, scheduling-staffing, video-streaming. Effort: config-only, light-edit, fork-and-modify. `--vocab` prints every field's values with counts if the user's words map to nothing obvious.

   Two habits make this reliable. Put the named product first if the user gave one ("calendly team booking" beats a paraphrase of their whole message), because the product name is the rarest and most telling word. When a vertical is obvious, run the query with `--vertical` and, if the top results still look off, run an empty query with the same `--vertical` to see the whole vertical; at eight to sixteen listings each, reading the list is cheaper than guessing.

2. For the top one to three, fetch the full record with `--detail <slug>`. That is where reach (the jobs an agent can and cannot do), the customization surface (env vars, config files, prompt files), editions with prices, gotchas, accounts, confidence and open questions live. Read reach before promising what an agent can do; the unreachable jobs are listed on purpose.

3. Write the answer in the chat. Lead with the best fit and why it matches the words the user used. Quote the "use it when" phrase that matched if it is apt. Put the get-it command in a code block. Link the page and the JSON twin so the user or their agent can go deeper.

Rank by fit to the need first. Within equal fit, prefer less effort (`config-only` over `fork-and-modify`) and higher reach coverage, because the site's promise is that most of the work is already done.

If the client speaks MCP instead, `scripts/mcp.mjs` in this folder is the same search as a stdio server (tools: search, listing, vocab). The script prints links built from the site address. If you ran it against a local copy with `MOTHERMACHINE_BASE` set, rewrite the links to `https://mothermachine.ai/` before the user sees them.

## Without Node

Fetch `https://mothermachine.ai/index/search.json` (about 130 KB), match the user's words against `name`, `alternativeTo`, `tagline` and `useWhen`, then fetch `https://mothermachine.ai/apps/<slug>.json` for the finalists. `https://mothermachine.ai/llms.txt` explains the vocabulary in one page.

## Examples

Input: `/mothermachine open source notion for our team wiki`
Output: leads with the listing whose `alternativeTo` names Notion or whose vertical is notes-knowledge and whose tagline says wiki; gives effort, operability, license, the docker or clone command, the AGPL gotcha if present, and the page link. Mentions one runner-up in a sentence.

Input: `is there anything my agent can drive to post to social media on a schedule?`
Output: filters to Operable in content-publishing, prefers official or native operability, and reports reach: which jobs (create post, schedule, publish, analytics) are reachable through the interface and which are not.

Input: `/mothermachine invoicing` with nothing matching the user's constraint (say, must be MIT)
Output: says no MIT-licensed invoicing listing exists, names the closest ones with their licenses, and points to the Candidate issue form.

## Keep in mind

- Keys and secrets are never in the records, only the names of environment variables the user will need. Do not invent values.
- Records were verified on a date; `lastActivity` says how fresh. If it is old, say so.
- The directory is curated and small by design. "Not listed" means not yet reviewed, not that nothing exists.
