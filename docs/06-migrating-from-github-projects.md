# 6. Migrating from GitHub Projects (optional)

If your tasks currently live in GitHub Projects boards and issues, a two-step script approach moves them into notes without touching GitHub. The scripts used for the original setup are specific to its boards and are not included; this describes how they work so you can write your own.

## Step 1: read-only export

A script calls the GitHub GraphQL API through the `gh` CLI (`gh api graphql -f query=...`) and writes JSON files to `export/`:

- **Issues** of each repository, with labels, assignees, milestone, parent/sub-issues and all comments (paginated, 50 per page).
- **Project items** of each board, with all field values (date, single-select such as *Status*, text, number, iteration), including draft items.
- A `summary.json` with counts, and a check that the number of items fetched equals the board's `totalCount`.
- Optional `--attachments`: downloads images and files referenced in issue bodies and comments (`github.com/user-attachments/...`, `*.githubusercontent.com/...`). Downloads are resumable: existing files are skipped, partial downloads use a `.part` name. The GitHub token is sent to GitHub but dropped on redirects, because the signed storage URLs reject it.

Configuration at the top of the script:

```python
OWNER = "<github-user-or-org>"
REPOS = ["<repo-a>", "<repo-b>"]
PROJECTS = {<project-number>: "<board name>"}
```

For an organisation board, query `organization(login: "<org>") { projectV2(number: <n>) ... }` instead of `user(login: ...)`.

Keep `export/` as your backup after you retire the boards.

## Step 2: convert to notes

A second script reads `export/` and writes notes:

1. **Map board columns to statuses**, per board, e.g.
   ```python
   STATUS = {<project-number>: {"Backlog": "backlog", "Todo": "todo", "In Progress": "doing",
                                "Waiting": "waiting", "Done": "done"}}
   ```
   Items without a status become `done` if the issue is closed, otherwise `backlog`.
2. **Decide `kind`, `type`, vault and folder** from labels or a board field (e.g. a *Type* field `Teaching` → `type: teaching`, folder `Teaching/`).
3. **Map date fields** to note properties (`deadline`, `submission`, ...) as `YYYY-MM-DD`, unquoted so Obsidian types them as dates.
4. **Write each note**: YAML front matter (empty values left out), the issue body, then the comments. Keep the issue URL in a property (e.g. `source`) for reference.
5. **Localise attachments**: copy downloaded files into `<vault>/_attachments/` (guessing missing extensions from the file's first bytes) and rewrite image tags and links to `![[file]]` / local links.
6. **Write setup files only if missing** (views, templates, Home, `.obsidian` config), so re-running never overwrites what you changed in Obsidian.

### Safe re-runs

Store, for each note written, the path and a hash of its content in `state.json`. On the next run:

- new items are added;
- notes whose current content still matches the stored hash (you have not edited them) are refreshed from the export;
- notes you edited are left alone and listed in a `report.md` for you to check.

This lets you run old and new systems side by side for a week or two (`export && convert` whenever something was still added on GitHub) before retiring the boards.

## Moving calendar dates

If the old setup published dates as ICS feeds, copy past and future dates into the new Google calendars once (for history), with the link line `Task note: obsidian://open?vault=<vault>&file=<path-without-.md>` in the description and `(<label>)` at the end of the title. Task Calendar Sync then links them to the notes on its first run (doc 04). After that, unsubscribe the old feeds.

## Retiring the old system

Do each step separately, and only once the new system has been in use for a while:

1. Final export (with attachments) and convert.
2. Unsubscribe old calendar feeds.
3. Disable any automation that published the boards (Actions, workers), revoke its tokens.
4. Archive the repositories (read-only; reversible) and close the projects (reversible).
