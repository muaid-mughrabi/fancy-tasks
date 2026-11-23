# 8. Ticket Agent: hand a task to an AI agent, follow its email

**Optional.** This chapter needs two desktop apps that are not part of the free core of this setup:

- **T3 Code** (runs coding agents such as Claude Code in threads, with a `t3` command-line tool), and
- **Fancy Mail** (a local email client that lets agents search, read and draft mail over MCP).

Check their current terms and costs. Agent runs use your AI provider's quota.

Source: [`plugin/ticket-agent/`](../plugin/ticket-agent/) (`main.js`, `manifest.json`, `styles.css`, and `CLAUDE.template.md` for the agent's rules). Tested on macOS with Obsidian 1.15; the phone side only queues requests.

## What it does

| You | The plugin |
|---|---|
| Click 🤖 **Send to T3** in a note's header (or file menu, or command) and pick a thread (new, this ticket's thread, or a recent one), a mode (*do it*: works and drafts emails, never sends; *plan first*: proposes a plan and waits) and an optional message | Starts or continues a T3 thread in the vault's project (`t3 thread start/send`), with the ticket text and the mode. Saves `agent_thread` and `agent_link` on the note, sets `activity`, and adds a line to the note's `## Agent log`. |
| Do the same on the phone | Saves the request in the note (`agent_request`). The desktop sends it once the note has synced. |
| (the agent) drafts a reply in an email conversation | The agent sets `mail_thread` (or `mail_draft` for a new email). |
| Send the drafted email in your mail app | The ticket moves to `waiting` (and Task Calendar Sync adds `follow_up`). |
| (someone) answers | The ticket moves to `todo` with *Read the answer from X*, you get a system notification, and the ticket's agent thread gets a message to continue: it reads the answer, updates the note and drafts a reply if needed. |
| Wait for a mail that has not arrived yet (*Link an email conversation* → *Wait for new mail like this*) | Saves the search as `mail_query`; the first new match counts as the answer. |

The mail watcher checks every 5 minutes on the desktop, reading Fancy Mail's connection file at runtime (`~/Library/Application Support/Fancy Mail/agent/connection.json`; the token is not copied anywhere). It reads only; drafts stay drafts.

Also in the plugin:

- **Activity panel**: a pulse icon in the left ribbon opens a panel in the left sidebar with every ticket's `## Agent log` entries, newest first, filterable (You, Agent, Email, Problems). Click a ticket name to open it.
- **Snooze…** (file menu / command): hide a task from Home until tomorrow, the weekend, next Monday, in a week, or a date (`snooze`). *Wake up now* removes it.
- **Turn into reference** / **Turn back into a task**: `kind: reference` clears status, next step and mail watching, and moves the note from `Tasks/` to `Reference/` if those folders exist.
- **Property repair**: if a note's properties stop parsing because a value with `: ` was written unquoted (agents do this), the plugin quotes it and logs "🩹 Repaired the note's properties".
- A failed send is written to the note's log and activity, not only shown as a short notice.

## Setup

1. **T3 Code**: add one project per vault, with the vault folder as the project folder, so the agent can read and edit the ticket note. Set the provider and model in the plugin settings (the `t3` CLI needs them when starting threads).
2. **Fancy Mail**: allow agents (*Settings → Connect agents*) and give each account at least *draft* access. Add Fancy Mail as an MCP server for the agent (Fancy Mail's agent README explains how), so threads in T3 can use the mail tools.
3. **Agent rules**: copy [`CLAUDE.template.md`](../plugin/ticket-agent/CLAUDE.template.md) to `<vault>/.claude/CLAUDE.md`, replacing `{{VAULT}}` and `{{ACCOUNTS}}` (which mail account sends for this vault). The rules tell the agent: drafts only, never send; how to update the note (`next`, `status`, `mail_thread`/`mail_draft`/`mail_query`, `activity`, `activity_at`, `## Agent log`); to quote text values and check the YAML; to read the clock with `date` instead of guessing; and what `points`/`coupons` tickets are for.
4. **Plugin**: copy `plugin/ticket-agent/` to `<vault>/.obsidian/plugins/ticket-agent/` in each vault, on the desktop and the phone, and enable it. Settings: `t3` path (default `~/.t3/bin/t3`), default mode, model, mail watching (on **one** computer), check interval, whether the agent continues automatically when an answer arrives, system notifications.

## Limits

- The desktop with Obsidian, T3 Code and Fancy Mail must be running for sends from the phone and for mail watching. Missed events are handled when it runs again.
- The phone gets no push notification; it sees the result on Home and in the Activity panel.
- Each automatic continuation is an agent run. Turn *Let the agent continue when an answer arrives* off to get only the notification.
- The note is the shared state: the agent edits it in the vault folder while Obsidian may also be editing it. Keep agent edits to frontmatter and the log section.
