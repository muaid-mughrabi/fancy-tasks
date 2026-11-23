# 7. A Home page that gets things done

The first version of this setup put the whole board on Home. It looked complete, and it was not useful: everything was visible, so nothing stood out. This chapter describes the Home page that replaced it. The design follows a few well-supported findings and assumes **no routines**: no daily planning step and no weekly review are required. Home does the planning, and plugins fill in the dates.

## Design rules

| Finding (evidence) | What Home does with it |
|---|---|
| Concrete plans ("if X, then I do Y") help people act (implementation intentions, Gollwitzer & Sheeran 2006, 94 studies) | Every active task shows its **next step**: one physical action that takes about 5 minutes to start. A ⚠ marks tasks without one. |
| Tasks stall when the next step is unclear, the task is too big, or it is unpleasant | The next step is the fix for all three: write only the first chunk. |
| Urgent work crowds out important work (mere urgency effect, Zhu et al. 2018) | Deep work gets **recurring calendar blocks**, not just tasks. |
| Recording progress helps (Harkin et al. 2016, 138 studies) | A small *Done this week* list. |
| All-items boards and elaborate priority schemes have no direct evidence | The full board is one click away, not on Home. |

Systems get dropped because of upkeep, because people stop opening them, because they are too rigid, or because information is scattered. So: few required fields, Home opens on start, folded sections instead of more pages, and everything (tasks, dates, emails, agent work) leads back to the one note.

## The sections

Each section is one view in `Views/Home.base` (examples: [`Home-work.base`](../examples/Views/Home-work.base), [`Home-personal.base`](../examples/Views/Home-personal.base); copy one to `<vault>/Views/Home.base`). [`Home-work.md`](../examples/Home-work.md) and [`Home-personal.md`](../examples/Home-personal.md) embed them.

| Section | Shows | Shown |
|---|---|---|
| **Today** | `doing`, `planned` ≤ today, anything due within 2 days, waiting tasks whose follow-up date has come. Each with *why now* (🔴 overdue, 🟠 due, 📌 planned, 🔔 follow-up due, ▶ doing) and the next step. Max 7 (work) / 5 (personal). | open |
| **Next 14 days** / **Due within 30 days** | Upcoming dates, soonest first. | open |
| **Up next** | Committed tasks (`todo`) not already under Today, oldest first. | open |
| **To sort** | New notes in the inbox folder and tasks without a status. | open |
| **Waiting** | Who you are waiting on, and the follow-up date (🔔 *chase now* once it passes). | folded |
| **Done this week** | Tasks with `closed` in the last 7 days. | folded |
| **Backlog** | Someday items. | folded |
| **Snoozed** | Tasks hidden until a date (`snooze`). | folded |
| **Points & coupons** (personal) | Tasks tagged `points` or `coupons`, by expiry. | folded |

Waiting tasks stay off Today until their follow-up date. Snoozed tasks are left out of every section except *Snoozed* until the date has come. Points and coupons appear only in their own section, until a date brings them to Today.

## Properties used

All optional. See doc 01 for the full schema.

| Property | Meaning | Set by |
|---|---|---|
| `next` | Next physical step, starting with a verb | you (or the agent, doc 08) |
| `planned` | The day you intend to work on it; puts it under Today. Stays in Obsidian (not in the calendar). | you |
| `deadline` (and other date fields) | Hard dates; go to Google Calendar | you |
| `waiting_on` | Who or what the task waits for | you |
| `follow_up` | When to chase a waiting task | **Task Calendar Sync**: a week ahead when the status becomes `waiting` |
| `closed` | When it was finished | **Task Calendar Sync**: today when the status becomes `done` |
| `snooze` | Hide from Home until this date | you, or *Snooze…* (doc 08) |
| `tags: [points]` | Loyalty points or miles: use them before they expire; `deadline` = expiry date | you |
| `tags: [coupons]` | Discounts worth using only if a purchase is planned anyway | you |
| `kind: reference` | Information kept for later, no task: off every board and Home list; listed in `Views/References.base` | you, or *Turn into reference* (doc 08) |

## Look: cards and folds

The snippet [`home.css`](../examples/obsidian/snippets/home.css) (enable it under *Appearance → CSS snippets*; Home needs `cssclasses: [wide, home]`) turns the embeds into a dashboard:

- each embedded view is a card titled by the view name with a count; the Bases toolbar is hidden (open the `.base` file to change a view);
- views are Bases **list** views: the title in bold, details in one muted line;
- on wide screens the cards sit in a grid and Today spans the full width; on phones they stack;
- folded sections are callouts of a custom type: `> [!fold]- Waiting` followed by `> ![[Views/Home.base#Waiting]]`;
- empty cards fade to a title line.

Lessons from building it:

- **Never hide a base view's body with CSS** (for example to hide empty cards). Bases renders list items lazily, only when the view is visible, so a hidden view never renders and stays empty forever. This showed on mobile first.
- The grid only applies in reading view. Open Home in reading view (below); in editing mode the cards stack in one column.

## Open Home on start

The free community plugin **Homepage** opens a note on start. Settings used ([`homepage-data.json`](../examples/obsidian/homepage-data.json), copy to `.obsidian/plugins/homepage/data.json`): open `Home.md` in **Reading view**, replace all open notes, and also open it when the last tab is closed.

## Calendar blocks

For research or writing, create a recurring event in the work calendar (for example three mornings a week, 90 minutes, a 5-minute reminder). Before a block starts, set `planned` to today on the task you will work on, so it is waiting under Today.
