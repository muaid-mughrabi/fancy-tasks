# 4. Task Calendar Sync (custom plugin)

A small plugin (one `main.js`, no build step) that keeps date fields on notes and their Google Calendar events in step, in both directions. It does not log in to Google itself: it asks Full Calendar Remastered for access through that plugin's API and uses its Google login.

Source: [`plugin/task-calendar-sync/`](../plugin/task-calendar-sync/). It is not in the community plugin store.

## What it does

| You do | The plugin does |
|---|---|
| Add a date (today or later) to a date field on a note | Creates an event in the configured calendar and writes the event link to `<field>_event` (only where *Create events for new dates* is on) |
| Change a linked date on the note | Moves the event (keeps its duration for timed events) |
| Clear a linked date on the note | Deletes the event and removes `<field>_event` |
| Move the event in any calendar client | Writes the new date into the note's field (only where *Copy calendar changes into notes* is on) |
| Delete the event in the calendar | Removes `<field>_event`; the date stays on the note, unlinked |
| Change the date in both places before a sync | The calendar wins; a notice tells you what the note had |

Details:

- **Fields** (defaults): `session`, `submission`, `defense`, `deadline`, `start`. Values are `YYYY-MM-DD` (all-day event) or `YYYY-MM-DDTHH:mm` (timed event, in the device's time zone).
- **Past dates never create events.** Existing linked events can still be moved to the past.
- **New events:**
  - Title: `<prefix> - <note name> (<label>)`, e.g. `Teaching - Week 3 slides (due)`. The label comes from the field map (`submission` → `due`). The prefix comes from the note's `type`, see settings.
  - Description: `Task note: obsidian://open?vault=<vault>&file=<path>`, so the event links back to the note.
  - All-day events are created as "free" (not blocking time). Timed events last 60 minutes.
  - Notes with `kind: session` are special: title `<client> - session`, length `planned_hours` (or `done_hours`, default 1 h), and they go to the sessions calendar if one is set.
- **Linking existing events:** on the first start with *Copy calendar changes into notes* on, the plugin scans the configured calendars for events whose description contains an `obsidian://open?vault=<this vault>&file=...` link and whose title ends in `(<label>)`, links them, and corrects note dates from the calendar. The command *Re-link existing calendar events* runs this again.
- **When it runs:**
  - Note → calendar: about 1.5 s after a note's properties change.
  - Calendar → note: every *N* minutes (default 2), and when the Obsidian window gets focus (at most every 30 s).
  - Observed in testing on a desktop: note → Google about 20 s, Google → note about 90 s.
- **Ignored:** files under `Templates/`, non-Markdown files, and calendars that are not set in this plugin's settings.
- **Commands:** *Sync now*, *Re-link existing calendar events*, *Show sync log*. The status bar shows the last sync time or an error.

## Closed and follow-up dates (0.2.0)

Independent of the calendar connection, the plugin remembers each note's `status` and reacts when it changes:

| Status change | Effect |
|---|---|
| → `done` | `closed: <today>` (if not set) |
| `done` → anything else | `closed` removed |
| → `waiting` | `follow_up: <today + 7 days>` (if not set) |
| `waiting` → anything else | `follow_up` removed |

This also catches changes made on another device: when the edited note syncs to the desktop, the change is seen there. Setting: *Set closed and follow-up dates* (`stampClosed`, `followUpDays` in `data.json`).

## Install

Requirements: Obsidian 1.12+ (1.14+ for the Kanban boards anyway), Full Calendar Remastered installed, enabled and logged in to Google in the same vault (doc 03).

Desktop:

1. Copy the folder `plugin/task-calendar-sync/` to `<your-vault>/.obsidian/plugins/task-calendar-sync/`. Only `main.js` and `manifest.json` are needed. Do not copy `data.example.json` there as `data.json` unless you want those settings.
2. Restart Obsidian (or *Reload app without saving*).
3. *Settings → Community plugins* → enable **Task Calendar Sync**.
4. Full Calendar Remastered asks you to approve access for Task Calendar Sync (scope: full access). Approve. If you decline, run *Reload app* to be asked again.
5. Open the plugin's settings and set at least *Calendar for new events* (the calendar name as shown in Full Calendar).

Android (the plugin is not in the store, so copy it by hand):

1. Connect the phone with USB debugging on, then copy the folder:
   ```
   adb push plugin/task-calendar-sync /storage/emulated/0/<path-to-vault>/.obsidian/plugins/
   ```
   Or copy it with a file manager. The path depends on where the vault is stored on the phone. A vault in app-private storage may not be reachable with adb or a file manager; keep phone vaults in shared storage such as `Documents/`. Verify this for your device.
2. Restart Obsidian on the phone, enable the plugin, and approve the access request.
3. Leave both *Copy calendar changes into notes* and *Create events for new dates* **off** on the phone (see below).

## Settings

In the settings tab:

| Setting | Key in `data.json` | Default | Meaning |
|---|---|---|---|
| Calendar for new events | `calendars.default` | empty | Full Calendar source name for new events. Also one of the calendars checked for changes. |
| Calendar for sessions | `calendars.session` | empty | Where `kind: session` events go. Empty = use the calendar above. |
| Title prefix | `titlePrefix` | `type` | `type` = derive from the note's `type`; any other text is used as a fixed prefix. |
| Type to prefix map | `typePrefixes` | `{}` | One `type = Prefix` per line, e.g. `admin = Admin`. Types not listed are capitalised (`teaching` → `Teaching`). Notes without a `type` get no prefix. |
| Check the calendar every (minutes) | `pollMinutes` | `2` | Poll interval. |
| Copy calendar changes into notes | `pull` | off | Calendar → note direction, and the first-run linking. |
| Create events for new dates | `createEvents` | off | Create events for new future dates. |

Only in `data.json`: `fields` maps each synced property to the label used in event titles. Edit it with Obsidian closed, or reload the plugin afterwards.

Example `data.json` for the desktop (also in [`plugin/task-calendar-sync/data.example.json`](../plugin/task-calendar-sync/data.example.json)):

```json
{
  "calendars": { "default": "Work", "session": "" },
  "titlePrefix": "type",
  "typePrefixes": { "admin": "Admin", "research": "Research" },
  "fields": { "session": "session", "submission": "due", "defense": "defense", "deadline": "deadline", "start": "start" },
  "pollMinutes": 2,
  "pull": true,
  "createEvents": true
}
```

The plugin also stores its own state in `data.json`: `fcToken` (the access token from Full Calendar), `state` (event ID → note path, field and last known value), `lastPull` and `linked`. Treat a real `data.json` as private and do not share or publish it.

## The one-writer rule

Enable **`pull`** and **`createEvents`** on **one device only**, normally the desktop that runs most often.

Why:

- With `pull` on two devices, both write the same calendar change into the same note. They then upload two versions of that note, which Sync Engine resolves as a conflict ("keep both" leaves you a duplicate).
- With `createEvents` on two devices, a new date can create two events before the `<field>_event` link has reached the other device.

On other devices the plugin still pushes edits of already-linked dates to Google (note → calendar), and adopts links that arrive from the desktop.

## Limitations

- **Calendar → note needs the pulling device to run.** If the phone is push-only, a date moved in Google reaches the note only after the desktop with `pull` on has run, written the note, and synced it (doc 05). Until then the phone shows the old date in the note, but the right date in the calendar.
- **Depends on Full Calendar Remastered internals.** Access goes through its public `requestAccess` / `withToken` API, but Google tokens are fetched via `getInternalState().providerRegistry.getInstance(id).authManager.getTokenForSource(source)`. A Full Calendar update can break this. Check the status bar and the log after updating it.
- **Same vault name on every device.** The link in event descriptions contains the vault name, and linking only accepts links for the current vault.
- **Renames:** the plugin follows renames inside Obsidian, but the link in an existing event's description keeps the old path. Linked fields keep working (through `<field>_event`); only *Re-link* will not find renamed notes.
- **Only dates are synced.** Titles, descriptions, durations of all-day events and reminders are not.
- **Reminders:** moving an event through the API was seen to turn off its default reminders (doc 03). Set alerts on important events directly.
- **Recurring events** were not tested.
- **Only Google sources** configured in Full Calendar are used; other calendar types are ignored.
- **Each device and vault has its own approval and its own Google login**, because plugin data and Obsidian's keychain are not shared between vaults or devices.
