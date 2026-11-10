# mothermachine plugin

Search [mothermachine.ai](https://mothermachine.ai), a directory of software an agent can adapt or operate, without leaving the chat. Claude finds one to three listings that fit and brings back the repo, the install command, how much is yours to change, and what an agent can and can't do with each one. This plugin is one skill, and it runs no code. The skill tells Claude which of the site's public JSON files to read.

## Try it

Ask Claude in your own words:

- "Is there an open source Calendly alternative I can self-host?"
- "Before I build this, what's out there for invoicing for a freelancer?"
- "Find a CRM my coding agent can drive over MCP."

Or type `/mothermachine` and what you need.

## What it fetches

Claude reads public files from https://mothermachine.ai with its own web fetch: one slice of the index, the alternatives index, and the records of the listings it shortlists. Your words stay in the chat. Only file names reach the site, and an alternatives page is named after the product it covers. Those requests reach the site's host like any page visit, which the [privacy page](https://mothermachine.ai/privacy.html) covers. The plugin writes no files and sends no telemetry.

## If something goes wrong

- A fetch that fails means the site could not be reached. Check that Claude has network access to mothermachine.ai.
- An answer that names no listing, or one that seems made up, can mean the fetch tool shortened a file. Ask Claude to read one vertical's file instead of the whole index.
- No matches? Try fewer words, or the name of the product you want to replace.

## More

The same search runs faster with a script, and as an MCP server, from https://github.com/Ramp-Jet/mothermachine-skill. That version needs Node 18 or later.

## Support and security

Report a problem at https://github.com/Ramp-Jet/mothermachine-skill/issues. Send security reports privately to privacy@rampjet.ai.

## License

MIT, in `LICENSE`.
