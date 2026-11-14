---
name: mothermachine
description: Search mothermachine.ai, a directory of software an agent can adapt or operate, and bring the answer back into the chat with the repo, the install command, how much is yours to change, and what an agent can and cannot do with it. Use this whenever the user types /mothermachine, asks whether something already exists that does X, wants an open-source or self-hosted alternative to a named product (Notion, Zapier, Calendly, QuickBooks, Shopify), asks what they could pull down and configure instead of building or subscribing, wants software their coding agent can drive through an MCP server, API, or CLI, or asks what software to run a kind of business on (a barbershop, a freelance practice). Reach for it even when they do not say "mothermachine". "Is there an app for", "something I can self-host for", "before I build this", and "what's out there for" are all this skill. Not for how-to questions about a product the user already runs, opinions on whether a product is worth its price, or general coding help.
compatibility: Needs network access to mothermachine.ai and a way to fetch a URL. Runs no code.
---

# mothermachine

mothermachine.ai lists software that a person or their agent can take and use: pull the source and configure it (Adaptable), drive it through an interface (Operable), or both. Every listing is published as plain JSON with the same vocabulary the site uses, so a search is two or three small fetches and the answer comes back into the chat. The user never has to open the site.

## What the user wants back

A short, decisive answer, not a catalog. Usually one to three candidates, each with enough to act on:

- Name, one line on what it does, and the page link.
- Which capability it is. Adaptable comes with an effort grade and a count of things to edit. Operable comes with an operability level, the interface kind, and reach coverage. State both when both apply.
- How to get it: the clone, install, pull, or deploy command from its editions.
- License, and whether a paid edition exists. Every listing has a free or open edition by the site's rules; `paid: true` means a priced edition also exists, often with the team features. An edition with `price: null` has no recorded price, so do not call it free unless it is open and downloadable. Say which features sit behind it when the record does.
- Say "open source" only when the full record has `openSource: true` and no `closedCore`. BUSL, Elastic and source-available code sits in readable repos but is not open source.
- Gotchas and accounts needed, before the user starts. A copyleft license, an unsigned Mac build, or a Twilio account is exactly what they want to know now rather than an hour in.
- Where the record is uncertain, say so. Every classified field carries confidence; `openQuestions` lists what the curator could not settle. `verdict` is the curator's: approve, dispute, or unverified. Most are unverified; say so in a word. A disputed record is a lead to check, not an answer.

If nothing fits, say that plainly and suggest the nearest vertical, or the Candidate issue form on the site if the user knows of something that belongs there.

## Procedure

Fetch the smallest file that answers the question. Each one below is a few kilobytes to about 50 KB, so read it whole rather than asking a fetch tool to summarize it.

1. Find the candidates.

   - **The user names a product to replace** ("an open source Calendly"). Fetch `https://mothermachine.ai/index/alternatives.json` and find the product by name, ignoring case. Each entry lists its listings. When the entry has a `page`, such as `alternatives/calendly.html`, also fetch its Markdown copy, `https://mothermachine.ai/alternatives/<product>.md`. It compares every listing for that product in one table, with license, agent interface, reach and effort.
   - **The user names a kind of business** ("software for my barbershop"). Fetch `https://mothermachine.ai/index/stacks.json` and find the stack whose `slug` names that business. When one does, fetch its `markdown` page, such as `https://mothermachine.ai/stacks/barbershop.md`. It names the listing for each job, how the apps hand work to each other, and what the user still does. Lead with that page; the listings in its `roles` are the candidates. No stack for that business means fall back to a need, below.
   - **The user describes a need** ("invoicing for a freelancer"). Pick the vertical and fetch `https://mothermachine.ai/index/vertical/<vertical>.json`. It holds every listing in that vertical, five to twenty-five each, with `name`, `summary`, `alternativeTo`, `effort`, `operability`, `coverage`, `interfaceKind` and `license`. Read them all and choose on fit. When two verticals could fit, fetch both.

   Verticals: content-publishing, ecommerce, notes-knowledge, invoicing-finance, smb-ops-crm, support-bookkeeping, scheduling-staffing, video-streaming, agent-infrastructure.

   Constraints the user states are filters. For "open source", drop listings whose `license` is not an open license, then confirm `openSource` in the full record. For "my agent drives it over MCP", prefer `interfaceKind: "mcp"`, and check `mcpServer` in the full record, because a listing whose stated interface is an API may also ship an MCP server. For "no code", prefer `effort: "config-only"`. Effort runs `config-only` < `light-edit` < `fork-and-modify`. Operability runs `native` (built for agents), `official` (the builder ships it), `wrapped` (a third party does), `config` (files only), `gui` (screen only).

   If the user's words map to no field, `https://mothermachine.ai/index/vocab.json` lists every field's values and a glossary with synonyms.

2. For the top one to three, fetch the full record, `https://mothermachine.ai/apps/<slug>.json`. That is where reach (the jobs an agent can and cannot do), the customization surface (env vars, config files, prompt files), editions with prices, gotchas, accounts, closed core, the builder's MCP server, confidence, verdict and open questions live. Read reach before promising what an agent can do; the unreachable jobs are listed on purpose. `https://mothermachine.ai/apps/<slug>.md` is the same record as Markdown, if that suits the fetch tool better.

3. Write the answer in the chat. Lead with the best fit and why it matches the words the user used. Quote a `useWhen` phrase from the record if it is apt. Put the get-it command in a code block. Link the page, `https://mothermachine.ai/apps/<slug>.html`, and its JSON copy so the user or their agent can go deeper. When the product has an alternatives page, link `https://mothermachine.ai/alternatives/<product>.html` too. When a stack answered the question, link `https://mothermachine.ai/stacks/<stack>.html` first.

Rank by fit to the need first. Within equal fit, prefer less effort (`config-only` over `fork-and-modify`) and higher reach coverage, because the site's promise is that most of the work is already done.

When the slices miss, `https://mothermachine.ai/index/search.json` is every listing in one file, with taglines and `useWhen` phrases, about 180 KB. Use it only if the fetch tool returns the whole file. A tool that cuts it short or summarizes it gives a wrong answer that looks right.

## Examples

Input: `/mothermachine open source notion for our team wiki`
Output: finds Notion in the alternatives index and reads its alternatives page; leads with the open-licensed listing whose summary says wiki; gives effort, operability, license, the docker or clone command, the AGPL gotcha if present, the page link and the Notion alternatives page. Mentions one runner-up in a sentence. Does not offer the BUSL-licensed one as open source.

Input: `is there anything my agent can drive to post to social media on a schedule?`
Output: reads the content-publishing slice, keeps the Operable listings, prefers official or native operability, and reports reach from the full record: which jobs (create post, schedule, publish, analytics) are reachable through the interface and which are not.

Input: `/mothermachine invoicing` with nothing matching the user's constraint (say, must be MIT)
Output: reads the invoicing-finance slice, says no MIT-licensed invoicing listing exists, names the closest ones with their licenses, and points to the Candidate issue form.

## Keep in mind

- Keys and secrets are never in the records, only the names of environment variables the user will need. Do not invent values.
- `lastActivity` is the software's last commit or release, not the date the record was checked. If it is old, say so. The record's own status is `verdict`.
- The directory is curated and small by design. "Not listed" means not yet reviewed, not that nothing exists.
