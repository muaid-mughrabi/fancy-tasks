# 3. Calendar

Google Calendar is the source of truth for dates. Every other client (Obsidian, Apple Calendar, the Android Google Calendar app) reads and writes the same Google calendars.

## 3.1 Create the Google calendars

1. Open https://calendar.google.com → *Settings* → *Add calendar* → *Create new calendar*.
2. Create one normal calendar per area, e.g. `Work` and `Personal` (optionally a separate one for appointments, e.g. `Sessions`).
3. Note the exact names; Full Calendar Remastered and Task Calendar Sync refer to calendars by the name shown in Full Calendar.

Optional title convention: prefix titles with the area or type (`Teaching - Week 3 slides`) so you can tell events apart on a phone widget. Task Calendar Sync does this for events it creates (doc 04).

## 3.2 Full Calendar Remastered (inside Obsidian)

Per vault:

1. *Settings → Community plugins* → turn off Restricted mode if asked → *Browse* → install and enable **Full Calendar Remastered**.
2. Its settings → *Calendar sources* → add **Google** → *Login with Google* → complete the sign-in in the browser.
3. Select the calendars for this vault (e.g. `Work` in the work vault; `Personal` and `Sessions` in the personal vault).
4. Set the folder for linked event notes to `Calendar`, and paste the contents of `examples/Templates/Event note (for Full Calendar).md` as the event note template. (Setting names may differ slightly between plugin versions.)
5. Open the calendar view and check that existing events appear.

Test both directions:

1. Create an event in Obsidian's calendar view; check that it appears in Google Calendar on the web or phone.
2. Move it on the phone; check that it moves in Obsidian. Remote calendars refresh periodically; the command *Revalidate remote calendars* forces a refresh (in the tested setup, changes showed up within about 5 minutes).

The Google login is stored in Obsidian's keychain, which is **per vault and per device**. Each vault on each device needs its own login (or a deliberate copy of the credentials). See doc 05.

## 3.3 Apple Calendar (macOS / iOS)

1. *System Settings → Internet Accounts → Add account → Google*, enable Calendars.
2. **Gotcha:** calendars created in Google after the account was added may not show up on Apple devices. Open https://calendar.google.com/calendar/syncselect while signed in, tick the new calendars and save. They then appear in Apple Calendar after the next refresh.

## 3.4 Android

1. Install or open the **Google Calendar** app with the same Google account.
2. In the app's side menu, make sure the new calendars are ticked (and under *Settings → (account)*, that sync is on for them).

## 3.5 Reminders gotcha

Editing an event from Apple Calendar, or moving it from Obsidian (Full Calendar or Task Calendar Sync), was seen to turn off that event's **default reminders** (the calendar's default notifications). This was observed, not fully explained.

What to do:

- For dates you must not miss, set an alert **on the event itself**, not only as a calendar default.
- After moving an important event from Obsidian or Apple Calendar, check its notifications once in Google Calendar.

## 3.6 Events and notes

There are two ways a date can be tied to a note:

1. **Event notes** (Full Calendar): choose *Open Note* on an event; Full Calendar creates a note in `Calendar/` from the event template. Set its `task` property to the task note; the task's inline "Dates" table then lists it.
2. **Date fields** (Task Calendar Sync): put a date in a field such as `deadline` on the task note itself; the plugin creates and maintains the event. See doc 04.

Option 2 is less work for single deadlines; option 1 suits meetings that need their own notes.
