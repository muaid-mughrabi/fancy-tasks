# 2. Boards with Bases

Bases is a core Obsidian plugin. A `.base` file is YAML: global `filters`, optional `formulas` and `properties` (display names), and a list of `views`. Each view can add its own filters, grouping and column order. The **Kanban** view type needs Obsidian 1.14 or later.

The examples here were written by hand from the Bases syntax. Open each one after copying it and check that it renders; if a key has changed in your Obsidian version, fix it in the view's settings UI and Obsidian rewrites the file.

## Files

| File (in `examples/Views/`) | Views |
|---|---|
| `Board.base` | **Active** (Kanban by status), **Teaching** (Kanban, only `type: teaching`), **Pipeline** (Kanban by `stage`, only `type: project`), **All tasks** (table grouped by type) |
| `Tasks.base` | **Active** (Kanban by status), **All tasks** (table grouped by status). For a personal vault. |
| `Research.base` | **Papers**, **Conferences**, **Reference notes** (tables by `kind`) |
| `Dates.base` | **Dates**: every note with a date field |
| `Sessions.base` | **Sessions**, **By client**, **By month** (tables with hour sums) |
| `Library.base` | **All** (Kanban by status, with an empty-status column), **Books** |

## The main board

`Board.base`, shortened to the parts that matter:

```yaml
filters:
  and:
    - 'kind == "task"'
    - '!file.inFolder("Templates")'
formulas:
  info: '[type, if(session, "session " + session.format("D MMM YY"), ""), if(submission, "due " + submission.format("D MMM YY"), ""), if(deadline, "due " + deadline.format("D MMM YY"), "")].filter(value).join(" · ")'
properties:
  formula.info:
    displayName: " "
views:
  - type: kanban
    name: Active
    filters:
      or:
        - 'status != "done"'
        - 'file.mtime > now() - "14d"'
    groupBy:
      property: note.status
      direction: ASC
    groupOrder:
      - backlog
      - todo
      - doing
      - waiting
      - done
    order:
      - file.name
      - formula.info
```

What it does:

- The global filter keeps only `kind: task` notes outside `Templates/`.
- `formula.info` builds one short line per card ("teaching · due 3 Mar 27"). Its display name is a single space so the card shows no label.
- **Active** hides `done` items whose note was not modified in the last 14 days.
- `groupOrder` fixes the column order.

Caveat: `file.mtime` changes whenever anything writes to the note, including Task Calendar Sync moving a date. A done task can therefore reappear on Active for 14 days after a calendar change. If that bothers you, add a `closed` date and filter on it instead.

A per-type board is the same view with one more filter:

```yaml
  - type: kanban
    name: Teaching
    filters:
      and:
        - 'type == "teaching"'
        - or:
            - 'status != "done"'
            - 'file.mtime > now() - "14d"'
    groupBy:
      property: note.status
      direction: ASC
    groupOrder: [backlog, todo, doing, waiting, done]
    order: [file.name, formula.info]
```

Copy it once per type (`research`, `admin`, ...).

A pipeline board groups by `stage` instead of `status`:

```yaml
  - type: kanban
    name: Pipeline
    filters: 'type == "project"'
    groupBy:
      property: note.stage
      direction: ASC
    groupOrder: [idea, planned, active, review, done]
    order: [file.name, formula.pipeline_info]
```

## Tables with sums

From `Sessions.base`:

```yaml
filters:
  and:
    - 'kind == "session"'
    - '!file.inFolder("Templates")'
formulas:
  month: 'start.format("YYYY-MM")'
views:
  - type: table
    name: By month
    groupBy:
      property: formula.month
      direction: DESC
    order: [file.name, note.client, note.done_hours]
    summaries:
      note.done_hours: Sum
```

## A base inside a note

A ```` ```base ```` code block in a note works like a `.base` file, and `this` refers to the note it is in. The Task template uses this to list the event notes that link back to the task:

````markdown
```base
filters:
  and:
    - file.hasLink(this.file)
    - file.inFolder("Calendar")
views:
  - type: table
    name: Dates
```
````

## Home note

Embed a single view with `![[Views/<file>.base#<view name>]]`:

```markdown
---
cssclasses: [wide]
---
![[Views/Board.base#Active]]

**Views:** [[Views/Board.base|Boards]] · [[Views/Research.base|Papers & conferences]] · [[Views/Dates.base|Dates]]
```

`cssclasses: [wide]` plus the `wide-boards.css` snippet (in `examples/obsidian/snippets/`) make the note and opened `.base` files use the full window width. Enable the snippet under *Settings → Appearance → CSS snippets*.

To open Home on start, use the core *Bookmarks* plugin or a "default note" community plugin (not covered here).

## Optional: a next-actions view (untested sketch)

Research on implementation intentions and planning suggests the Home page should lead to the next concrete action rather than show everything. If you add `next_action` and `planned` properties (doc 01), a view along these lines could go first on Home. It was not part of the tested setup; check the syntax in your version.

```yaml
  - type: table
    name: Today
    filters:
      and:
        - 'status != "done"'
        - 'status != "backlog"'
        - or:
            - 'planned <= today()'
            - 'deadline <= today() + "2d"'
    order: [file.name, note.next_action, note.planned, note.deadline]
    limit: 7
```

What Bases does not do: draw a calendar grid (use Full Calendar Remastered), send notifications (use calendar alerts), or write values on its own (use a plugin such as Task Calendar Sync).
