"use strict";
/*
 * Task Calendar Sync
 * Copyright (c) <year> <your name>
 * SPDX-License-Identifier: MIT (see LICENSE)
 *
 * Keeps the date fields of task notes (by default: session, submission, defense, deadline, start)
 * and their Google Calendar events in step, in both directions.
 *
 * - The calendar is the source of truth: a date moved in Google (phone, Apple Calendar,
 *   Obsidian's calendar view) is written back to the note's field.
 * - Editing the date on a note moves the event; clearing it deletes the event;
 *   adding a new (today or later) date creates an event in the configured calendar.
 * - Each linked field gets a companion property `<field>_event` holding the event link.
 *
 * Google access is borrowed from Full Calendar Remastered (no extra login): the plugin
 * asks it once for access through its public API, then calls the Google Calendar API directly.
 *
 * "Copy calendar changes into notes" (pull) and "Create events for new dates" (createEvents)
 * should be enabled on ONE device only. Both are off by default.
 */
const { Plugin, Notice, requestUrl, moment, Modal, PluginSettingTab, Setting, TFile } = require("obsidian");

const FC_ID = "full-calendar-remastered";
const GCAL = "https://www.googleapis.com/calendar/v3";
const DEFAULTS = {
  calendars: { default: "", session: "" }, // Full Calendar source names
  titlePrefix: "type",                      // "type" = from the note's `type`, otherwise a fixed text
  typePrefixes: {},                         // note type (lower case) -> title prefix; missing types are capitalised
  fields: { session: "session", submission: "due", defense: "defense", deadline: "deadline", start: "start" },
  pollMinutes: 2,
  pull: false,          // copy calendar changes into notes (enable on ONE device only)
  createEvents: false,  // create events for new dates (enable on ONE device only)
  fcToken: null,
  state: {},     // eventId -> { path, field, value, calendarId, minutes }
  lastPull: {},  // calendarId -> ISO timestamp
  linked: false,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;

function normalize(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (!m) return s;
  return m[2] ? `${m[1]}T${m[2].padStart(2, "0")}:${m[3]}` : m[1];
}
function eventValue(ev) {
  if (ev.start && ev.start.date) return ev.start.date;
  if (ev.start && ev.start.dateTime) return moment(ev.start.dateTime).format("YYYY-MM-DDTHH:mm");
  return "";
}
function eventMinutes(ev) {
  if (ev.start && ev.start.dateTime && ev.end && ev.end.dateTime)
    return moment(ev.end.dateTime).diff(moment(ev.start.dateTime), "minutes");
  return null;
}
function parseEventLink(link) {
  try {
    const eid = new URL(String(link)).searchParams.get("eid");
    if (!eid) return null;
    let b64 = eid.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const [eventId, cal] = atob(b64).split(" ");
    if (!eventId || !cal) return null;
    let calendarId = cal;
    if (cal.endsWith("@g")) calendarId = cal.slice(0, -2) + "@group.calendar.google.com";
    else if (cal.endsWith("@m")) calendarId = cal.slice(0, -2) + "@gmail.com";
    return { eventId, calendarId };
  } catch (e) {
    return null;
  }
}
function parsePrefixMap(text) {
  const map = {};
  for (const line of String(text || "").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key && val) map[key] = val;
  }
  return map;
}
function formatPrefixMap(map) {
  return Object.entries(map || {}).map(([k, v]) => `${k} = ${v}`).join("\n");
}

module.exports = class TaskCalendarSync extends Plugin {
  async onload() {
    this.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), await this.loadData());
    this.settings.state = this.settings.state || {};
    this.settings.lastPull = this.settings.lastPull || {};
    this.settings.typePrefixes = this.settings.typePrefixes || {};
    this.log = [];
    this.chain = Promise.resolve();
    this.timers = new Map();
    this.lastSync = 0;
    this.ready = false;
    this.statusEl = this.addStatusBarItem();
    this.setStatus("starting");
    this.addCommand({ id: "sync-now", name: "Sync now", callback: () => this.syncAll(true) });
    this.addCommand({ id: "relink", name: "Re-link existing calendar events", callback: () => this.exclusive(() => this.linkExisting(true)) });
    this.addCommand({ id: "show-log", name: "Show sync log", callback: () => new LogModal(this.app, this.log).open() });
    this.addSettingTab(new SyncSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => this.start());
  }

  onunload() {
    for (const t of this.timers.values()) clearTimeout(t);
  }

  // ------------------------------------------------------------------ plumbing
  setStatus(text) { this.statusEl.setText(`📅 ${text}`); }
  note(msg, notice) {
    this.log.push(`${moment().format("YYYY-MM-DD HH:mm:ss")}  ${msg}`);
    if (this.log.length > 500) this.log.shift();
    console.log("[task-calendar-sync]", msg);
    if (notice) new Notice(`Task Calendar Sync: ${msg}`, 8000);
  }
  async save() { await this.saveData(this.settings); }
  exclusive(fn) {
    this.chain = this.chain.then(fn).catch((e) => {
      this.note(`error: ${e && e.message ? e.message : e}`, true);
      this.setStatus("error (see log)");
    });
    return this.chain;
  }
  fcPublic() {
    const fc = this.app.plugins && this.app.plugins.plugins && this.app.plugins.plugins[FC_ID];
    return fc && fc.api ? fc.api : null;
  }

  async start() {
    for (let i = 0; i < 60 && !this.fcPublic(); i++) await sleep(1000);
    if (!this.fcPublic()) {
      this.setStatus("needs Full Calendar");
      this.note("Full Calendar Remastered is not enabled in this vault", true);
      return;
    }
    if (!(await this.ensureAccess())) return;
    this.ready = true;
    this.registerEvent(this.app.metadataCache.on("changed", (file) => this.queuePush(file)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));
    this.registerDomEvent(window, "focus", () => this.syncAll(false));
    this.registerInterval(window.setInterval(() => this.syncAll(false), Math.max(1, this.settings.pollMinutes) * 60000));
    await this.exclusive(async () => { if (!this.settings.linked && this.settings.pull !== false) await this.linkExisting(false); });
    await this.syncAll(false);
  }

  async ensureAccess() {
    const pub = this.fcPublic();
    let api = this.settings.fcToken ? pub.withToken(this.settings.fcToken) : null;
    if (!api) {
      this.setStatus("waiting for approval");
      const token = await pub.requestAccess(
        this.manifest.id,
        "Keep the dates on task notes and their Google Calendar events in sync, using your existing Google login.",
        ["system:full-access"]
      );
      if (!token) {
        this.setStatus("not approved");
        this.note("access was not approved; run 'Reload app' to be asked again", true);
        return false;
      }
      this.settings.fcToken = token;
      await this.save();
      api = pub.withToken(token);
    }
    this.fc = api;
    return !!api;
  }

  // ------------------------------------------------------------------ Google via Full Calendar's login
  sources() {
    return (this.fc.getInternalState().settings.calendarSources || []).filter((s) => s.type === "google");
  }
  sourceByName(name) { return this.sources().find((s) => s.name === name); }
  sourceByCalendarId(id) { return this.sources().find((s) => s.calendarId === id); }
  syncedSources() {
    const names = [this.settings.calendars.default, this.settings.calendars.session].filter(Boolean);
    return names.map((n) => this.sourceByName(n)).filter(Boolean);
  }
  async token(src) {
    const inst = this.fc.getInternalState().providerRegistry.getInstance(src.id);
    const t = inst && inst.authManager ? await inst.authManager.getTokenForSource(inst.source || src) : null;
    if (!t) throw new Error(`no Google access for "${src.name}" - reconnect Google in Full Calendar's settings`);
    return t;
  }
  async gapi(src, method, path, body, query) {
    const tok = await this.token(src);
    let url = GCAL + path;
    if (query) url += "?" + new URLSearchParams(query).toString();
    const res = await requestUrl({
      url, method, throw: false,
      headers: { Authorization: `Bearer ${tok}` },
      contentType: body ? "application/json" : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status >= 400) {
      const err = new Error(`${method} ${path} -> HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 || !res.text ? null : res.json;
  }
  async listEvents(src, query) {
    const out = [];
    let pageToken;
    do {
      const q = Object.assign({ maxResults: "2500" }, query, pageToken ? { pageToken } : {});
      const r = await this.gapi(src, "GET", `/calendars/${enc(src.calendarId)}/events`, null, q);
      out.push(...((r && r.items) || []));
      pageToken = r && r.nextPageToken;
    } while (pageToken);
    return out;
  }

  // ------------------------------------------------------------------ helpers
  frontmatter(file) {
    const c = this.app.metadataCache.getFileCache(file);
    return (c && c.frontmatter) || {};
  }
  fileAt(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }
  labelToField(label) {
    return Object.keys(this.settings.fields).find((f) => this.settings.fields[f] === label) || null;
  }
  /** Which note + field an event belongs to, from the link in its description and the "(label)" in its title. */
  linkOf(ev) {
    const m = String(ev.description || "").match(/obsidian:\/\/open\?vault=([^&\s"<]+)&file=([^\s"<]+)/);
    if (!m || decodeURIComponent(m[1]) !== this.app.vault.getName()) return null;
    const path = decodeURIComponent(m[2]) + ".md";
    const file = this.fileAt(path);
    if (!file) return null;
    const lm = String(ev.summary || "").match(/\(([^()]+)\)\s*$/);
    let field = lm ? this.labelToField(lm[1].trim()) : null;
    if (!field && this.frontmatter(file).kind === "session") field = "start";
    return field ? { file, field } : null;
  }
  /** Title prefix: a fixed text, or derived from the note's `type` (mapped via settings, else capitalised). */
  prefix(fm) {
    if (this.settings.titlePrefix !== "type") return this.settings.titlePrefix;
    const t = String(fm.type || "").trim().toLowerCase();
    if (!t) return "";
    const map = this.settings.typePrefixes || {};
    return map[t] || t.charAt(0).toUpperCase() + t.slice(1);
  }
  dateBody(val, minutes) {
    if (val.includes("T")) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const s = moment(val, "YYYY-MM-DDTHH:mm");
      return {
        start: { dateTime: s.format("YYYY-MM-DDTHH:mm:ss"), timeZone: tz },
        end: { dateTime: s.clone().add(minutes || 60, "minutes").format("YYYY-MM-DDTHH:mm:ss"), timeZone: tz },
      };
    }
    return { start: { date: val }, end: { date: moment(val, "YYYY-MM-DD").add(1, "day").format("YYYY-MM-DD") } };
  }

  // ------------------------------------------------------------------ first run: link events created earlier
  async linkExisting(manual) {
    this.setStatus("linking events");
    let links = 0, fixes = 0;
    for (const src of this.syncedSources()) {
      const startedAt = new Date(Date.now() - 60000).toISOString();
      const events = await this.listEvents(src, { showDeleted: "false", timeMin: "2000-01-01T00:00:00Z" });
      for (const ev of events) {
        const l = this.linkOf(ev);
        if (!l) continue;
        const val = eventValue(ev);
        this.settings.state[ev.id] = { path: l.file.path, field: l.field, value: val, calendarId: src.calendarId, minutes: eventMinutes(ev) };
        const fm = this.frontmatter(l.file);
        if (fm[`${l.field}_event`] === ev.htmlLink && normalize(fm[l.field]) === val && fm.event !== ev.htmlLink) continue;
        await this.app.fileManager.processFrontMatter(l.file, (f) => {
          if (f[`${l.field}_event`] !== ev.htmlLink) { f[`${l.field}_event`] = ev.htmlLink; links++; }
          if (normalize(f[l.field]) !== val) { f[l.field] = val; fixes++; }
          if (f.event === ev.htmlLink) delete f.event; // older single-link property
        });
      }
      this.settings.lastPull[src.calendarId] = startedAt;
    }
    this.settings.linked = true;
    await this.save();
    this.note(`linked ${links} date fields to calendar events, corrected ${fixes} dates from the calendar`, manual || links > 0);
  }

  // ------------------------------------------------------------------ calendar -> notes
  syncAll(manual) {
    if (!this.ready) return Promise.resolve();
    if (!manual && Date.now() - this.lastSync < 30000) return Promise.resolve();
    this.lastSync = Date.now();
    return this.exclusive(async () => {
      this.setStatus("syncing");
      if (this.settings.pull !== false) await this.pull();
      await this.save();
      this.setStatus(`synced ${moment().format("HH:mm")}`);
      if (manual) this.note("sync finished", true);
    });
  }

  async pull() {
    for (const src of this.syncedSources()) {
      const since = this.settings.lastPull[src.calendarId];
      const startedAt = new Date(Date.now() - 60000).toISOString();
      if (!since) { this.settings.lastPull[src.calendarId] = startedAt; continue; }
      const events = await this.listEvents(src, { updatedMin: since, showDeleted: "true" });
      for (const ev of events) {
        let st = this.settings.state[ev.id];
        if (!st) {
          // an event that points at a note but is not linked yet (e.g. created by hand with the link)
          const l = ev.status !== "cancelled" && this.linkOf(ev);
          if (l && !this.frontmatter(l.file)[`${l.field}_event`]) {
            st = this.settings.state[ev.id] = { path: l.file.path, field: l.field, value: "", calendarId: src.calendarId, minutes: eventMinutes(ev) };
            await this.app.fileManager.processFrontMatter(l.file, (f) => { f[`${l.field}_event`] = ev.htmlLink; });
          } else continue;
        }
        const file = this.fileAt(st.path);
        if (!file) { delete this.settings.state[ev.id]; continue; }
        if (ev.status === "cancelled") {
          delete this.settings.state[ev.id];
          await this.app.fileManager.processFrontMatter(file, (f) => { delete f[`${st.field}_event`]; });
          this.note(`${file.basename}: the ${st.field} event was deleted in the calendar - the date stays on the note, unlinked`, true);
          continue;
        }
        const val = eventValue(ev);
        st.minutes = eventMinutes(ev) || st.minutes;
        if (val === st.value) continue;
        const current = normalize(this.frontmatter(file)[st.field]);
        if (current !== st.value && current !== val)
          this.note(`${file.basename}: ${st.field} changed in both places - the calendar wins (${val}, note had ${current})`, true);
        st.value = val;
        await this.app.fileManager.processFrontMatter(file, (f) => { f[st.field] = val; });
        this.note(`${file.basename}: ${st.field} -> ${val} (from calendar)`);
      }
      this.settings.lastPull[src.calendarId] = startedAt;
    }
  }

  // ------------------------------------------------------------------ notes -> calendar
  queuePush(file) {
    if (!this.ready || !(file instanceof TFile) || file.extension !== "md" || file.path.startsWith("Templates/")) return;
    clearTimeout(this.timers.get(file.path));
    this.timers.set(file.path, setTimeout(() => {
      this.timers.delete(file.path);
      this.exclusive(() => this.push(file));
    }, 1500));
  }

  async push(file) {
    if (!this.fileAt(file.path)) return;
    const fm = this.frontmatter(file);
    const today = moment().format("YYYY-MM-DD");
    let dirty = false;
    for (const field of Object.keys(this.settings.fields)) {
      const val = normalize(fm[field]);
      const link = fm[`${field}_event`];
      if (link) {
        const ref = parseEventLink(link);
        const src = ref && this.sourceByCalendarId(ref.calendarId);
        if (!src) continue;
        let st = this.settings.state[ref.eventId];
        if (!st) { // linked by hand or on another device: adopt as it is
          this.settings.state[ref.eventId] = { path: file.path, field, value: val, calendarId: src.calendarId, minutes: null };
          dirty = true;
          continue;
        }
        if (st.path !== file.path) { st.path = file.path; dirty = true; }
        if (val === st.value) continue;
        const evPath = `/calendars/${enc(src.calendarId)}/events/${enc(ref.eventId)}`;
        try {
          if (!val) {
            await this.gapi(src, "DELETE", evPath);
            delete this.settings.state[ref.eventId];
            await this.app.fileManager.processFrontMatter(file, (f) => { delete f[`${field}_event`]; });
            this.note(`${file.basename}: ${field} removed - calendar event deleted`, true);
          } else {
            await this.gapi(src, "PATCH", evPath, this.dateBody(val, st.minutes));
            st.value = val;
            this.note(`${file.basename}: ${field} -> ${val} (sent to calendar)`);
          }
        } catch (e) {
          if (e.status === 404 || e.status === 410) {
            delete this.settings.state[ref.eventId];
            await this.app.fileManager.processFrontMatter(file, (f) => { delete f[`${field}_event`]; });
            this.note(`${file.basename}: its ${field} event no longer exists - unlinked`, true);
          } else throw e;
        }
        dirty = true;
      } else if (val && val.slice(0, 10) >= today && this.settings.createEvents !== false) {
        await this.createEvent(file, fm, field, val);
        dirty = true;
      }
    }
    if (dirty) await this.save();
  }

  async createEvent(file, fm, field, val) {
    const isSession = fm.kind === "session";
    const calName = isSession && this.settings.calendars.session ? this.settings.calendars.session : this.settings.calendars.default;
    if (!calName) { this.note("no calendar set for new events (see the plugin's settings)", true); return; }
    const src = this.sourceByName(calName);
    if (!src) { this.note(`calendar "${calName}" is not connected in Full Calendar`, true); return; }
    const client = String(fm.client || "").replace(/[[\]]/g, "").trim();
    const prefix = this.prefix(fm);
    const title = isSession
      ? `${client || file.basename} - session`
      : `${prefix ? prefix + " - " : ""}${file.basename} (${this.settings.fields[field]})`;
    const minutes = isSession ? Math.round(60 * (Number(fm.planned_hours || fm.done_hours) || 1)) : 60;
    const body = Object.assign(
      {
        summary: title,
        description: `Task note: obsidian://open?vault=${enc(this.app.vault.getName())}&file=${enc(file.path.replace(/\.md$/, ""))}`,
      },
      this.dateBody(val, minutes),
      val.includes("T") ? {} : { transparency: "transparent" }
    );
    const ev = await this.gapi(src, "POST", `/calendars/${enc(src.calendarId)}/events`, body);
    this.settings.state[ev.id] = { path: file.path, field, value: val, calendarId: src.calendarId, minutes };
    await this.save();
    await this.app.fileManager.processFrontMatter(file, (f) => { f[`${field}_event`] = ev.htmlLink; });
    this.note(`${file.basename}: created "${title}" in ${calName}`, true);
  }

  async onRename(file, oldPath) {
    let changed = false;
    for (const st of Object.values(this.settings.state)) {
      if (st.path === oldPath) { st.path = file.path; changed = true; }
    }
    if (changed) await this.save();
  }
};

class LogModal extends Modal {
  constructor(app, lines) { super(app); this.lines = lines; }
  onOpen() {
    this.titleEl.setText("Task Calendar Sync - log");
    const pre = this.contentEl.createEl("pre", { cls: "task-calendar-sync-log" });
    pre.setText(this.lines.length ? this.lines.slice().reverse().join("\n") : "Nothing yet.");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.maxHeight = "60vh";
    pre.style.overflow = "auto";
  }
  onClose() { this.contentEl.empty(); }
}

class SyncSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    const p = this.plugin;
    const s = p.settings;
    containerEl.empty();
    containerEl.createEl("p", { text: "Date fields on notes and their Google Calendar events are kept in step. The calendar wins if both changed. Calendar names are the names shown in Full Calendar's calendar list." });
    new Setting(containerEl).setName("Calendar for new events").addText((t) => t.setValue(s.calendars.default).onChange(async (v) => { s.calendars.default = v.trim(); await p.save(); }));
    new Setting(containerEl).setName("Calendar for sessions").setDesc("Notes with kind: session get their events here. Leave empty to use the calendar above.").addText((t) => t.setValue(s.calendars.session || "").onChange(async (v) => { s.calendars.session = v.trim(); await p.save(); }));
    new Setting(containerEl).setName("Title prefix").setDesc('"type" uses the note\'s type (mapped below, otherwise capitalised); any other text is used as is.').addText((t) => t.setValue(s.titlePrefix).onChange(async (v) => { s.titlePrefix = v.trim() || "type"; await p.save(); }));
    new Setting(containerEl).setName("Type to prefix map").setDesc('One per line, e.g. "admin = Admin". Types not listed are capitalised; notes without a type get no prefix.').addTextArea((t) => t.setValue(formatPrefixMap(s.typePrefixes)).onChange(async (v) => { s.typePrefixes = parsePrefixMap(v); await p.save(); }));
    new Setting(containerEl).setName("Check the calendar every (minutes)").addText((t) => t.setValue(String(s.pollMinutes)).onChange(async (v) => { s.pollMinutes = Math.max(1, Number(v) || 2); await p.save(); }));
    containerEl.createEl("p", { text: "Enable the next two settings on ONE device only (for example your desktop). Otherwise two devices may edit the same note or create the same event twice." });
    new Setting(containerEl).setName("Copy calendar changes into notes").addToggle((t) => t.setValue(s.pull === true).onChange(async (v) => {
      s.pull = v;
      await p.save();
      if (v && p.ready && !s.linked) p.exclusive(() => p.linkExisting(true));
    }));
    new Setting(containerEl).setName("Create events for new dates").addToggle((t) => t.setValue(s.createEvents === true).onChange(async (v) => { s.createEvents = v; await p.save(); }));
    containerEl.createEl("p", { text: `Linked date fields: ${Object.keys(s.state).length}. Fields synced: ${Object.entries(s.fields).map(([f, l]) => `${f} "(${l})"`).join(", ")}. Change fields in this plugin's data.json.` });
  }
}
