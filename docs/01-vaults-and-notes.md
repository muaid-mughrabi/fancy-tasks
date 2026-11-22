# 1. Vaults and notes

## Why several vaults

One vault per life area (for example `Work` and `Personal`) keeps the areas apart: separate boards, separate calendars, separate sync prefixes, and you can share or drop one area without touching the other. The cost is that plugins and settings are set up once per vault (and per device, see doc 05).

## Vault layout

Example layout for a work-type vault (the folder names are only a convention; the views filter by properties, not folders, except where noted):

```
<your-vault>/
  Home.md                 start page with the embedded board
  Inbox/                  new notes land here (app.json: newFileFolderPath)
  Teaching/  Research/  Admin/   one folder per type (optional)
  Calendar/               event notes created by Full Calendar Remastered
  Views/                  .base files (boards and tables)
  Templates/              note templates (ignored by views and by Task Calendar Sync)
  _attachments/           images and PDFs (app.json: attachmentFolderPath)
  .obsidian/              config, plugins, CSS snippets
```

A personal vault can look the same, with for example `Tasks/`, `Sessions/`, `Library/`.

Steps:

1. Create an empty folder per vault and open it in Obsidian (*Open folder as vault*).
2. Close Obsidian, then copy the files from `examples/obsidian/` into `<your-vault>/.obsidian/`:
   - `core-plugins.json` enables Bases, Properties, Templates and others.
   - `types.json` sets the property types (dates as dates, numbers as numbers).
   - `app.json` sets the new-note folder (`Inbox`) and the attachment folder.
   - `templates.json` points the Templates plugin at `Templates/`.
   - `snippets/wide-boards.css` makes boards full width.
   If the vault already has these files, merge them by hand instead of overwriting.
3. Copy `examples/Views/` to `<your-vault>/Views/` and `examples/Templates/` to `<your-vault>/Templates/`.
4. Copy `examples/Home-work.md` (or `Home-personal.md`) to `<your-vault>/Home.md`.
5. Open Obsidian, then *Settings → Appearance → CSS snippets* and enable `wide-boards`.

## Property schema

| Property | Type | Used for |
|---|---|---|
| `kind` | text | What the note is: `task`, `session`, `paper`, `conference`, `reference`, `book`, `watch`, `client` ... Views filter on it. |
| `status` | text | `backlog`, `todo`, `doing`, `waiting`, `done` (see below). Board columns. |
| `type` | text | Area within the vault, e.g. `teaching`, `research`, `admin`, `project`. Used for per-type boards and for the event title prefix. |
| `stage` | text | Optional pipeline stage for longer projects, e.g. `idea`, `planned`, `active`, `review`, `done`. |
| `tags` | tags | Free tags. |
| `deadline`, `submission`, `session`, `defense` | date | Date fields kept in step with Google Calendar by Task Calendar Sync. |
| `start` | datetime | Start of a `kind: session` note (date and time). |
| `<field>_event` | text | Written by Task Calendar Sync: link to the Google event for that field. Do not edit by hand unless you mean to re-link. |
| `created`, `closed` | date | When the task was opened / finished. |
| `planned_hours`, `done_hours` | number | Session length; `planned_hours` sets the event length when a session event is created. |
| `client` | text | For sessions: a link to the client note, e.g. `"[[Client A]]"`. Used in the session event title. |
| `task` | text | On event notes in `Calendar/`: a link back to the task. |
| `people` | list | Optional. |
| `link`, `source` | text | URLs. |

The date fields (`session`, `submission`, `defense`, `deadline`, `start`) are the plugin's defaults. You can rename or add fields in the plugin's `data.json` (doc 04); keep `types.json` in step so Obsidian treats them as dates.

Date values are `YYYY-MM-DD` (all-day) or `YYYY-MM-DDTHH:mm` (timed).

## Status meanings

| Status | Meaning |
|---|---|
| `backlog` | Someday; not committed. |
| `todo` | Committed and ready to start. |
| `doing` | Being worked on this week. Keep this column short. |
| `waiting` | Blocked on someone or something else. |
| `done` | Finished. Stays on the Active board for 14 days after the note was last modified, then drops off (still visible in the *All tasks* table). |

A note with no `status` still matches the task views; in a Kanban grouped by status it lands in an "empty" group (verify how your Obsidian version labels it).

Optional extension, based on research on implementation intentions: give each `todo`/`doing` note a `next_action` (one concrete step, starting with a verb) and a `planned` day, and build the Home page around "what do I do next" instead of showing every item. The example views do not use these properties; see doc 02 for a sketch.

## Templates

In `examples/Templates/`:

| Template | For |
|---|---|
| `Task.md` | A task. Includes an inline Bases table that lists event notes in `Calendar/` that link to this task. |
| `Session.md` | A timed appointment with a client (`kind: session`, `start`, `planned_hours`). Task Calendar Sync creates its event in the "sessions" calendar if one is set. |
| `Library item.md` | Books, things to watch, reference material. |
| `Event note (for Full Calendar).md` | The template Full Calendar Remastered uses when you choose *Open Note* on an event (doc 03). The `{{...}}` placeholders are filled by that plugin; check its documentation for the current list. |

Using a template: create a note, then run *Templates: Insert template* from the command palette.

Note: Task Calendar Sync ignores anything under `Templates/`, so dates in templates never create events.
