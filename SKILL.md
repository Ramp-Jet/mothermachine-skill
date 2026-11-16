---
name: mothermachine
description: Search mothermachine.ai, a directory of software an agent can adapt or operate, and bring the answer back into the chat with the repo, the install command, how much is yours to change, and what an agent can and cannot do with it. Use this whenever the user types /mothermachine, asks whether something already exists that does X, wants an open-source or self-hosted alternative to a named product (Notion, Zapier, Calendly, QuickBooks, Shopify), asks what they could pull down and configure instead of building or subscribing, wants software their coding agent can drive through an MCP server, API, or CLI, or asks what software to run a kind of business on (a barbershop, a freelance practice). Reach for it even when they do not say "mothermachine". "Is there an app for", "something I can self-host for", "before I build this", and "what's out there for" are all this skill. Not for how-to questions about a product the user already runs, opinions on whether a product is worth its price, or general coding help.
compatibility: Needs network access to mothermachine.ai and Node 18 or later for the bundled script. Without Node, follow the manual fetch steps.
---

# mothermachine

mothermachine.ai lists software that a person or their agent can take and use: pull the source and configure it (Adaptable), drive it through an interface (Operable), or both. Every listing is published as plain JSON with the same vocabulary the site uses, so the whole search happens in two or three small fetches and the answer comes back into the chat. The user never has to open the site.

## What the user wants back

A short, decisive answer, not a catalog. Usually one to three candidates, each with enough to act on:

- Name, one line on what it does, and the page link.
- Which capability it is. Adaptable comes with an effort grade and a count of things to edit. Operable comes with an operability level, the interface kind, and reach coverage. State both when both apply.
- How to get it: the clone, install, pull, or deploy command from its editions.
- License, and whether a paid edition exists. Every listing has a free or open edition by the site's rules; `paid: true` means a priced edition also exists, often with the team features. An edition with `price: null` has no recorded price, so do not call it free unless it is open and downloadable. Say which features sit behind it when the record does.
- Say "open source" only when the result line shows an open license with no "core closed" mark. BUSL, Elastic and source-available code sits in readable repos but is not open source. `--open` applies the site's rule.
- Gotchas and accounts needed, before the user starts. A copyleft license, an unsigned Mac build, or a Twilio account is exactly what they want to know now rather than an hour in.
- Where the record is uncertain, say so. Every classified field carries confidence; `openQuestions` lists what the curator could not settle. `verdict` is the curator's: approve, dispute, or unverified. Most are unverified; say so in a word. A disputed record is a lead to check, not an answer.

If nothing fits, say that plainly, name the nearest vertical and how many listings it holds, and give the submit page (`https://mothermachine.ai/submit.html`) if the user knows of something that belongs there.

## Procedure

1. Translate the need before you search. The script matches words against names, alternative-to products, taglines and the listings' own "use it when" phrases; it does not understand sentences, and filler words ("take", "send", "manage", "need", "online") are dropped. Reduce what the user said to the one or two things the software must do, and run one short query for each: "I need an app to take bookings and send invoices" is `"booking"` and then `"invoicing"`, never the whole sentence. A message with two needs is two searches, not one. When the vertical is obvious, add `--vertical`.

   Run the bundled script by its full path (this skill's directory plus `scripts/search.mjs`; it does not need a particular working directory). It fetches `index/search.json` once, ranks the query words against those fields, weighting rare words over common ones, and prints compact results with links. When the query names a kind of business it also fetches `index/stacks.json` and prints that business's stack first, even when no single listing matches.

   ```
   node <skill-dir>/scripts/search.mjs "<the user's need in their words>" [--vertical v] [--effort e] [--interface k] [--open] [--operable] [--adaptable] [--limit n]
   ```

   Verticals: content-publishing, ecommerce, notes-knowledge, invoicing-finance, smb-ops-crm, support-bookkeeping, scheduling-staffing, video-streaming, agent-infrastructure. Effort: config-only, light-edit, fork-and-modify. Interface: mcp, api, cli, sdk, config, gui; `mcp` also includes listings whose builder ships an MCP server beside another interface. `--vocab` prints every field's values with counts if the user's words map to nothing obvious.

   Constraints the user states are filters, not search words. "Open source" and "self-hosted" are stop words, so pass `--open` when they say open source, `--interface mcp` when the agent must drive it over MCP, and `--effort config-only` when they will not touch code.

   Two habits make this reliable. Put the named product first if the user gave one ("calendly team booking" beats a paraphrase of their whole message), because the product name is the rarest and most telling word. When a vertical is obvious, run the query with `--vertical` and, if the top results still look off, run an empty query with the same `--vertical` to see the whole vertical; at five to twenty-five listings each, reading the list is cheaper than guessing.

   When nothing clears the bar, the script says so and names the nearest vertical with its listing count and the submit page; a thin result (one or two listings) carries the same note. A need in everyday words ("sell t-shirts online") often matches no record text. Browse the named vertical before saying nothing fits, and never pass a weak match to the user as the answer. The MCP server returns the same note as `hint`, `nearest` and `submit`.

2. For the top one to three, fetch the full record with `--detail <slug>`. That is where reach (the jobs an agent can and cannot do), the customization surface (env vars, config files, prompt files), editions with prices, gotchas, accounts, closed core, the builder's MCP server, confidence, verdict and open questions live. Read reach before promising what an agent can do; the unreachable jobs are listed on purpose.

3. Write the answer in the chat. Lead with the best fit and why it matches the words the user used. Quote the "use it when" phrase that matched if it is apt. Put the get-it command in a code block. Link the page and the JSON twin so the user or their agent can go deeper. When the script printed a compare line, link that alternatives page too: one table of every listing for that product. When it printed a Stack line, the user named a kind of business: lead with that stack page. It names the listing for each job the business needs, how the apps hand work to each other, and what the user still does. Read its Markdown twin before you describe the handoffs. With a filter set, a job marked outside your filters has a listing that does not meet them; say so rather than dropping the job.

Rank by fit to the need first. Within equal fit, prefer less effort (`config-only` over `fork-and-modify`) and higher reach coverage, because the site's promise is that most of the work is already done.

If the client speaks MCP instead, `scripts/mcp.mjs` in this folder is the same search as a stdio server (tools: search, listing, vocab) with the same filters. Its search returns the stack in a `stacks` field. Nothing starts it for you, the Claude plugin included. The user adds it to their MCP client once, for example with `claude mcp add mothermachine -- npx -y mothermachine mcp`. The script prints links built from the site address. If you ran it against a local copy with `--base`, rewrite the links to `https://mothermachine.ai/` before the user sees them.

## Without Node

Fetch `https://mothermachine.ai/llms.txt` once: it explains the vocabulary and lists every file below with its size. Then fetch `https://mothermachine.ai/index/match/<vertical>.json` for the vertical the need points at (every listing in it, with `name`, `alternativeTo`, `tagline`, `useWhen`, the filter flags, `compare` pages, and the `html`, `json` and `md` addresses of each record), match the user's words against those fields, honor `openSource`, `closedCore`, `interfaceKind` and `mcpServer` for stated constraints, then fetch each finalist's `json` address. Every file in that ladder fits in one fetch of 90,000 characters; `index/search.json`, which the script reads, does not, and a fetch tool that stops early shows only part of it with no sign the rest exists. When the user names a kind of business, fetch `https://mothermachine.ai/index/stacks.json`; each stack has a `page` and a `markdown` twin.

## Examples

Input: `/mothermachine open source notion for our team wiki`
Output: runs with `--open`; leads with the listing whose `alternativeTo` names Notion or whose vertical is notes-knowledge and whose tagline says wiki; gives effort, operability, license, the docker or clone command, the AGPL gotcha if present, the page link and the Notion alternatives page. Mentions one runner-up in a sentence. Does not offer the BUSL-licensed one as open source.

Input: `is there anything my agent can drive to post to social media on a schedule?`
Output: filters to Operable in content-publishing, prefers official or native operability, and reports reach: which jobs (create post, schedule, publish, analytics) are reachable through the interface and which are not.

Input: `/mothermachine invoicing` with nothing matching the user's constraint (say, must be MIT)
Output: says no MIT-licensed invoicing listing exists, names the closest ones with their licenses, and points to the Candidate issue form.

## Keep in mind

- Keys and secrets are never in the records, only the names of environment variables the user will need. Do not invent values.
- `lastActivity` is the software's last commit or release, not the date the record was checked. If it is old, say so. The record's own status is `verdict`.
- The directory is curated and small by design. "Not listed" means not yet reviewed, not that nothing exists.
