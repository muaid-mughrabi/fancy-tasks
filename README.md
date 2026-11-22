# Obsidian tasks + Google Calendar, synced across devices

A personal task and calendar setup built on Obsidian:

- **Tasks are notes** with YAML properties (`kind`, `status`, `type`, dates).
- **Boards and tables** come from Obsidian's core **Bases** plugin and are embedded on a Home note.
- **Dates live in Google Calendar**, one calendar per life area. You can see and edit them inside Obsidian (Full Calendar Remastered), on the phone, or in Apple Calendar.
- A small custom plugin, **Task Calendar Sync**, keeps the date fields on notes and their Google events in step, in both directions.
- **Devices sync** through Sync Engine against a Cloudflare R2 bucket, with client-side encryption.

You can keep life areas apart (for example work and personal) by using one vault and one calendar per area.

## Architecture

```
   Desktop (Obsidian)                         Phone (Obsidian, Android)
 +---------------------------+              +---------------------------+
 | Vault "Work" / "Personal" |              | same vaults (same names)  |
 |  notes + Bases boards     |              |  notes + Bases boards     |
 |  Full Calendar Remastered |              |  Full Calendar Remastered |
 |  Task Calendar Sync       |              |  Task Calendar Sync       |
 |   (pull + create: ON)     |              |   (pull + create: OFF)    |
 |  Sync Engine (S3 + enc.)  |              |  Sync Engine (S3 + enc.)  |
 +-----+---------------+-----+              +-----+---------------+-----+
       |               |                          |               |
       |   encrypted   +--------> Cloudflare R2 <-+               |
       |   files          bucket: obsidian-vaults/{work,personal}/ |
       |                                                          |
       +--------------> Google Calendar <-------------------------+
                        (one calendar per area; source of truth for dates)
                              ^              ^
                    Apple Calendar     Google Calendar app (Android)
```

## What is free

| Piece | Cost |
|---|---|
| Obsidian (desktop + mobile) | free for personal use (check the current licence terms) |
| Bases (core plugin) | included in Obsidian |
| Full Calendar Remastered | free community plugin |
| Sync Engine | free, MIT licence |
| Task Calendar Sync (this repo) | free, MIT licence |
| Google Calendar | free with a Google account |
| Cloudflare R2 | free tier (10 GB storage at the time of writing; check current limits and whether a payment method is required) |

## Prerequisites

- Obsidian **1.14 or later** on every device (the Kanban view of Bases needs it).
- A Google account.
- A Cloudflare account (for R2).
- For the phone: Android with Obsidian installed. iOS should work in principle but was not tested.
- Optional: `wrangler` (Cloudflare CLI) and the `aws` CLI to create and test the bucket from a terminal.

## Contents

1. [Vaults and notes](docs/01-vaults-and-notes.md): vault layout, property schema, status meanings, templates
2. [Boards with Bases](docs/02-boards-with-bases.md): the views, with copy-pasteable `.base` files
3. [Calendar](docs/03-calendar.md): Google calendars, Full Calendar Remastered, Apple and Android clients
4. [Task Calendar Sync](docs/04-task-calendar-sync.md): the custom plugin, its settings, and the one-writer rule
5. [Device sync with R2](docs/05-device-sync-r2.md): the bucket, a scoped token, Sync Engine, encryption, phone setup
6. [Migrating from GitHub Projects](docs/06-migrating-from-github-projects.md) (optional)

Files:

- [`plugin/task-calendar-sync/`](plugin/task-calendar-sync/): the plugin (`main.js`, `manifest.json`, `data.example.json`)
- [`examples/`](examples/): `.base` views, note templates, Home notes, and `.obsidian` config files (in `examples/obsidian/`; copy them to `<your-vault>/.obsidian/`)

## Order of setup

1. Create the vaults and copy the examples in (docs 01, 02).
2. Create the Google calendars and connect Full Calendar Remastered (doc 03).
3. Install Task Calendar Sync on the desktop and enable `pull` and `createEvents` there (doc 04).
4. Set up R2 and Sync Engine on the desktop, then on the phone (doc 05).

## Licence

MIT, see [LICENSE](LICENSE). Third-party plugins keep their own licences.
