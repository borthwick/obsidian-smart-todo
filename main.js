var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SmartTodoPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/types.ts
var EFFORTS = ["light", "moderate", "heavy"];
var EFFORT_WEIGHT = {
  heavy: 3,
  moderate: 2,
  light: 1
};
var DEFAULT_MANAGED_FILE = "Tasks.md";
var DEFAULT_SETTINGS = {
  managedFiles: DEFAULT_MANAGED_FILE
};
var TABS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "overdue", label: "Overdue" },
  { id: "backlog", label: "Backlog" },
  { id: "completed", label: "Completed" }
];
var VIEW_TYPE_SMART_TODO = "smart-todo-view";

// src/scope.ts
function normalizePath(raw) {
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
}
function parseScope(raw) {
  const parts = (raw != null ? raw : "").split(/[,\n]/).map(normalizePath).filter((p) => p.length > 0);
  const seen = /* @__PURE__ */ new Set();
  const entries = [];
  for (const path of parts) {
    const key = path.toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    entries.push({
      kind: /\.md$/i.test(path) ? "file" : "folder",
      path
    });
  }
  if (entries.length === 0) {
    return {
      entries: [{ kind: "file", path: DEFAULT_MANAGED_FILE }],
      usedFallback: true
    };
  }
  return { entries, usedFallback: false };
}
function isInScope(path, scope) {
  const p = normalizePath(path).toLowerCase();
  for (const entry of scope.entries) {
    const e = entry.path.toLowerCase();
    if (entry.kind === "file") {
      if (p === e)
        return true;
    } else if (p.startsWith(`${e}/`)) {
      return true;
    }
  }
  return false;
}
function primaryManagedFile(scope) {
  const file = scope.entries.find((e) => e.kind === "file");
  if (file)
    return file.path;
  const folder = scope.entries.find((e) => e.kind === "folder");
  if (folder)
    return `${folder.path}/${DEFAULT_MANAGED_FILE}`;
  return DEFAULT_MANAGED_FILE;
}
function describeScope(scope) {
  return scope.entries.map((e) => e.kind === "folder" ? `${e.path}/ (folder)` : e.path).join(", ");
}

// src/parser.ts
var TASK_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s*(.*)$/;
var DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;
var DEFER_RE = /⏳\s*(\d{4}-\d{2}-\d{2})/;
var DONE_DATE_RE = /✅\s*(\d{4}-\d{2}-\d{2})/;
var INLINE_FIELD_RE = /\[([A-Za-z][\w-]*)\s*::\s*([^\]]*)\]/g;
var EMOJI_DATE_TOKEN_RE = /(?:📅|⏳|✅|🛫|➕|❌|🔁)\s*\d{4}-\d{2}-\d{2}/g;
var PRIORITY_EMOJI_RE = /[🔺⏫🔼🔽⏬]/g;
function parseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m)
    return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
function isSameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function normalizeEffort(value) {
  const v = value.trim().toLowerCase();
  if (v === "light" || v === "moderate" || v === "heavy")
    return v;
  return null;
}
function extractInlineFields(text) {
  const out = {};
  const re = new RegExp(INLINE_FIELD_RE.source, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}
function deriveTitle(body) {
  return body.replace(new RegExp(INLINE_FIELD_RE.source, "g"), "").replace(EMOJI_DATE_TOKEN_RE, "").replace(PRIORITY_EMOJI_RE, "").replace(/\s+/g, " ").trim();
}
function parseTaskLine(line, filePath, lineNumber) {
  const m = TASK_LINE_RE.exec(line);
  if (!m)
    return null;
  const checkbox = m[1];
  const body = m[2];
  const fields = extractInlineFields(body);
  const dueMatch = DUE_RE.exec(body);
  const deferMatch = DEFER_RE.exec(body);
  const doneMatch = DONE_DATE_RE.exec(body);
  const pushesRaw = fields["pushes"];
  const pushesParsed = pushesRaw === void 0 ? NaN : parseInt(pushesRaw, 10);
  return {
    filePath,
    lineNumber,
    rawText: line,
    title: deriveTitle(body),
    status: checkbox === " " ? "open" : "done",
    due: dueMatch ? parseDate(dueMatch[1]) : null,
    defer: deferMatch ? parseDate(deferMatch[1]) : null,
    doneDate: doneMatch ? parseDate(doneMatch[1]) : null,
    effort: fields["effort"] ? normalizeEffort(fields["effort"]) : null,
    pushes: Number.isFinite(pushesParsed) && pushesParsed > 0 ? pushesParsed : 0,
    project: fields["project"] || null,
    assigned: fields["assigned"] || null
  };
}
function parseTasksFromContent(content, filePath) {
  const tasks = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i], filePath, i);
    if (task)
      tasks.push(task);
  }
  return tasks;
}
async function scanScope(app, scope) {
  const files = app.vault.getMarkdownFiles().filter((file) => isInScope(file.path, scope));
  const all = [];
  for (const file of files) {
    let content;
    try {
      content = await app.vault.cachedRead(file);
    } catch (e) {
      continue;
    }
    if (content.indexOf("[ ]") === -1 && !/\[[xX]\]/.test(content))
      continue;
    all.push(...parseTasksFromContent(content, file.path));
  }
  return all;
}

// src/settings.ts
var import_obsidian = require("obsidian");
var SmartTodoSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const el = this.containerEl;
    el.empty();
    el.createEl("h2", { text: "Smart ToDo" });
    el.createEl("h3", { text: "Managed scope" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Smart ToDo only reads the files listed here. Nothing else in the vault is scanned \u2014 old meeting notes and planners full of stale checkboxes stay invisible."
    });
    const summary = el.createDiv({ cls: "smart-todo-scope-summary" });
    const renderSummary = () => {
      summary.empty();
      const scope = parseScope(this.plugin.settings.managedFiles);
      const matches = this.app.vault.getMarkdownFiles().filter((f) => this.plugin.isInManagedScope(f.path));
      if (scope.usedFallback) {
        summary.createDiv({
          cls: "setting-item-description",
          text: `No scope set \u2014 falling back to ${DEFAULT_MANAGED_FILE}.`
        });
      }
      for (const entry of scope.entries) {
        summary.createDiv({
          cls: "setting-item-description",
          text: entry.kind === "folder" ? `\u{1F4C1} ${entry.path}/ \u2014 all .md files beneath it` : `\u{1F4C4} ${entry.path}`
        });
      }
      summary.createDiv({
        cls: "setting-item-description",
        text: `Currently matching ${matches.length} file${matches.length === 1 ? "" : "s"} in the vault. New tasks go to ${primaryManagedFile(scope)}.`
      });
    };
    new import_obsidian.Setting(el).setName("Managed files").setDesc(
      `Comma-separated. An entry ending in .md is a single file; anything else is treated as a folder and all .md files under it are included. Example: "${DEFAULT_MANAGED_FILE}, Projects/Tasks"`
    ).addTextArea((text) => {
      text.setPlaceholder(DEFAULT_MANAGED_FILE).setValue(this.plugin.settings.managedFiles).onChange(async (value) => {
        this.plugin.settings.managedFiles = value;
        await this.plugin.saveSettings();
        renderSummary();
        this.plugin.refreshViews();
      });
      text.inputEl.rows = 3;
      text.inputEl.addClass("smart-todo-scope-input");
    });
    el.appendChild(summary);
    renderSummary();
    new import_obsidian.Setting(el).setName("Create the managed file").setDesc(
      "Creates the file new tasks are appended to, if it doesn't exist yet."
    ).addButton(
      (btn) => btn.setButtonText("Create now").onClick(async () => {
        await this.plugin.ensurePrimaryFile();
        renderSummary();
      })
    );
  }
};

// src/add-task-modal.ts
var import_obsidian2 = require("obsidian");
var AddTaskModal = class extends import_obsidian2.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.title = "";
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Add task" });
    const commit = () => {
      const value = this.title.trim();
      if (!value)
        return;
      this.close();
      this.onSubmit(value);
    };
    new import_obsidian2.Setting(contentEl).setName("Task").addText((text) => {
      text.setPlaceholder("What needs doing?").onChange((value) => {
        this.title = value;
      });
      text.inputEl.addClass("smart-todo-modal-input");
      text.inputEl.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          evt.preventDefault();
          commit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new import_obsidian2.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Add").setCta().onClick(commit)
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/writer.ts
var import_obsidian3 = require("obsidian");
var StaleTaskError = class extends Error {
};
function getFile(app, path) {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof import_obsidian3.TFile)) {
    throw new StaleTaskError(`File no longer exists: ${path}`);
  }
  return file;
}
async function replaceTaskLine(app, task, newLine) {
  const file = getFile(app, task.filePath);
  const mutate = (content) => {
    const lines = content.split("\n");
    let index = task.lineNumber;
    if (lines[index] !== task.rawText) {
      const matches = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === task.rawText)
          matches.push(i);
      }
      if (matches.length === 0) {
        throw new StaleTaskError(
          `Task line changed on disk in ${task.filePath}; refresh and retry.`
        );
      }
      if (matches.length > 1) {
        throw new StaleTaskError(
          `Found ${matches.length} identical task lines in ${task.filePath}; refusing to guess.`
        );
      }
      index = matches[0];
    }
    lines[index] = newLine;
    return lines.join("\n");
  };
  const vault = app.vault;
  if (typeof vault.process === "function") {
    await vault.process(file, mutate);
  } else {
    const content = await app.vault.read(file);
    await app.vault.modify(file, mutate(content));
  }
}
function setInlineField(line, key, value) {
  const re = new RegExp(`\\[${key}\\s*::\\s*[^\\]]*\\]`, "i");
  if (re.test(line)) {
    return line.replace(re, `[${key}:: ${value}]`);
  }
  return `${line.replace(/\s+$/, "")} [${key}:: ${value}]`;
}
function removeInlineField(line, key) {
  const re = new RegExp(`\\s*\\[${key}\\s*::\\s*[^\\]]*\\]`, "i");
  return line.replace(re, "");
}
function setEmojiDate(line, emoji, re, date) {
  const token = `${emoji} ${formatDate(date)}`;
  if (re.test(line)) {
    return line.replace(re, token);
  }
  return `${line.replace(/\s+$/, "")} ${token}`;
}
function removeEmojiDate(line, re) {
  return line.replace(new RegExp(`\\s*${re.source}`), "");
}
function setCheckbox(line, done) {
  return line.replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+\[)[ xX](\])/,
    `$1${done ? "x" : " "}$2`
  );
}
function buildToggledLine(task, nowDone) {
  let line = setCheckbox(task.rawText, nowDone);
  if (nowDone) {
    line = setEmojiDate(line, "\u2705", DONE_DATE_RE, startOfToday());
  } else {
    line = removeEmojiDate(line, DONE_DATE_RE);
  }
  return line;
}
async function toggleTaskDone(app, task, nowDone) {
  await replaceTaskLine(app, task, buildToggledLine(task, nowDone));
}
function buildPushedLine(task, days = 1) {
  let line = task.rawText;
  if (task.due) {
    line = setEmojiDate(line, "\u{1F4C5}", DUE_RE, addDays(task.due, days));
  } else if (task.defer) {
    line = setEmojiDate(line, "\u23F3", DEFER_RE, addDays(task.defer, days));
  } else {
    line = setEmojiDate(line, "\u{1F4C5}", DUE_RE, addDays(startOfToday(), days));
  }
  line = setInlineField(line, "pushes", String(task.pushes + 1));
  return line;
}
async function pushTask(app, task, days = 1) {
  await replaceTaskLine(app, task, buildPushedLine(task, days));
}
function buildEffortLine(task, effort) {
  return effort === null ? removeInlineField(task.rawText, "effort") : setInlineField(task.rawText, "effort", effort);
}
async function setTaskEffort(app, task, effort) {
  await replaceTaskLine(app, task, buildEffortLine(task, effort));
}
var MANAGED_FILE_STUB = "# Tasks\n\n";
function buildAppendedContent(content, title) {
  const line = `- [ ] ${title.trim()}`;
  const lines = content.split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "")
    lines.pop();
  if (lines.length === 0)
    return `${line}
`;
  if (/\n[ \t]*\n[ \t\r\n]*$/.test(content))
    lines.push("");
  lines.push(line);
  return `${lines.join("\n")}
`;
}
async function ensureManagedFile(app, path) {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof import_obsidian3.TFile)
    return existing;
  const slash = path.lastIndexOf("/");
  if (slash > 0) {
    const folder = path.slice(0, slash);
    if (!app.vault.getAbstractFileByPath(folder)) {
      try {
        await app.vault.createFolder(folder);
      } catch (e) {
      }
    }
  }
  return app.vault.create(path, MANAGED_FILE_STUB);
}
async function appendTask(app, path, title) {
  const trimmed = title.trim();
  if (!trimmed)
    throw new StaleTaskError("Task title is empty.");
  const file = await ensureManagedFile(app, path);
  const vault = app.vault;
  if (typeof vault.process === "function") {
    await vault.process(
      file,
      (content) => buildAppendedContent(content, trimmed)
    );
  } else {
    const content = await app.vault.read(file);
    await app.vault.modify(file, buildAppendedContent(content, trimmed));
  }
}
async function safeWrite(fn) {
  try {
    await fn();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    new import_obsidian3.Notice(`Smart ToDo: ${msg}`, 6e3);
    console.error("[smart-todo] write failed", e);
    return false;
  }
}

// src/view.ts
var import_obsidian4 = require("obsidian");

// src/filters.ts
function isResting(task, today = startOfToday()) {
  return !!task.defer && task.defer.getTime() > today.getTime();
}
function isOverdue(task, today = startOfToday()) {
  return task.status === "open" && !!task.due && task.due.getTime() < today.getTime();
}
function isDueToday(task, today = startOfToday()) {
  return task.status === "open" && !!task.due && isSameDay(task.due, today);
}
function compareForToday(a, b, today = startOfToday()) {
  const rank = (t) => {
    if (isOverdue(t, today))
      return 0;
    if (isDueToday(t, today))
      return 1;
    if (t.due)
      return 2;
    return 3;
  };
  const byRank = rank(a) - rank(b);
  if (byRank !== 0)
    return byRank;
  if (a.due && b.due && a.due.getTime() !== b.due.getTime()) {
    return a.due.getTime() - b.due.getTime();
  }
  const effortOf = (t) => t.effort ? EFFORT_WEIGHT[t.effort] : 0;
  const byEffort = effortOf(b) - effortOf(a);
  if (byEffort !== 0)
    return byEffort;
  const byPushes = b.pushes - a.pushes;
  if (byPushes !== 0)
    return byPushes;
  return a.title.localeCompare(b.title);
}
function compareCompleted(a, b) {
  const at = a.doneDate ? a.doneDate.getTime() : 0;
  const bt = b.doneDate ? b.doneDate.getTime() : 0;
  if (at !== bt)
    return bt - at;
  return a.title.localeCompare(b.title);
}
function bucketFor(tasks, tab, today = startOfToday()) {
  const open = tasks.filter((t) => t.status === "open");
  const weekEnd = addDays(today, 6);
  let selected;
  switch (tab) {
    case "today":
      selected = open.filter(
        (t) => !isResting(t, today) && !!t.due && t.due.getTime() <= today.getTime()
      );
      break;
    case "week":
      selected = open.filter(
        (t) => !isResting(t, today) && !!t.due && t.due.getTime() <= weekEnd.getTime()
      );
      break;
    case "overdue":
      selected = open.filter((t) => isOverdue(t, today));
      break;
    case "backlog":
      selected = open.filter(
        (t) => isResting(t, today) || !t.due || t.due.getTime() > today.getTime()
      );
      break;
    case "completed":
      selected = tasks.filter((t) => t.status === "done");
      break;
    default:
      selected = open;
  }
  selected = tab === "completed" ? selected.sort(compareCompleted) : selected.sort((a, b) => compareForToday(a, b, today));
  return {
    tasks: selected,
    restingCount: open.filter((t) => isResting(t, today)).length
  };
}

// src/view.ts
var SmartTodoView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.activeTab = "today";
    this.tasks = [];
    this.loading = false;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_SMART_TODO;
  }
  getDisplayText() {
    return "Smart ToDo";
  }
  getIcon() {
    return "list-checks";
  }
  async onOpen() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("smart-todo-root");
    const header = root.createDiv({ cls: "smart-todo-header" });
    this.tabBarEl = header.createDiv({ cls: "smart-todo-tabs" });
    const refreshBtn = header.createEl("button", {
      cls: "smart-todo-refresh",
      attr: { "aria-label": "Rescan vault" }
    });
    (0, import_obsidian4.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => void this.refresh());
    this.renderAddRow(root);
    this.summaryEl = root.createDiv({ cls: "smart-todo-summary" });
    this.listEl = root.createDiv({ cls: "smart-todo-list" });
    this.renderTabs();
    await this.refresh();
  }
  async onClose() {
    var _a;
    (_a = this.containerEl.children[1]) == null ? void 0 : _a.empty();
  }
  /** Rescan the vault, then repaint. */
  async refresh() {
    this.loading = true;
    this.render();
    this.tasks = await this.plugin.scan();
    this.loading = false;
    this.render();
  }
  /**
   * Capture row. Title only — Enter appends `- [ ] <text>` to the managed file
   * and the vault-modify event folds it back into the list. Dates and effort
   * get set afterwards from the row UI, so capture never blocks on metadata.
   */
  renderAddRow(root) {
    const wrap = root.createDiv({ cls: "smart-todo-add" });
    this.addInputEl = wrap.createEl("input", {
      cls: "smart-todo-add-input",
      attr: { type: "text", placeholder: "Add a task\u2026" }
    });
    const commit = async () => {
      const value = this.addInputEl.value.trim();
      if (!value)
        return;
      this.addInputEl.disabled = true;
      const ok = await this.plugin.addTask(value);
      this.addInputEl.disabled = false;
      if (ok)
        this.addInputEl.value = "";
      this.addInputEl.focus();
      await this.refresh();
    };
    this.addInputEl.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        void commit();
      } else if (evt.key === "Escape") {
        this.addInputEl.value = "";
        this.addInputEl.blur();
      }
    });
    const addBtn = wrap.createEl("button", {
      cls: "smart-todo-add-btn",
      attr: { "aria-label": "Add task" }
    });
    (0, import_obsidian4.setIcon)(addBtn, "plus");
    addBtn.addEventListener("click", () => void commit());
  }
  renderTabs() {
    this.tabBarEl.empty();
    for (const tab of TABS) {
      const btn = this.tabBarEl.createEl("button", {
        cls: "smart-todo-tab",
        text: tab.label
      });
      if (tab.id === this.activeTab)
        btn.addClass("is-active");
      btn.addEventListener("click", () => {
        this.activeTab = tab.id;
        this.renderTabs();
        this.render();
      });
    }
  }
  render() {
    if (!this.listEl)
      return;
    const today = startOfToday();
    this.listEl.empty();
    this.summaryEl.empty();
    if (this.loading && this.tasks.length === 0) {
      this.summaryEl.setText("Scanning\u2026");
      return;
    }
    const { tasks, restingCount } = bucketFor(this.tasks, this.activeTab, today);
    const countLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
    this.summaryEl.createSpan({ cls: "smart-todo-count", text: countLabel });
    if (this.activeTab === "today" || this.activeTab === "week") {
      if (restingCount > 0) {
        this.summaryEl.createSpan({
          cls: "smart-todo-resting",
          text: `${restingCount} ${restingCount === 1 ? "task" : "tasks"} resting in the backlog.`
        });
      }
    }
    if (tasks.length === 0) {
      const empty = this.listEl.createDiv({
        cls: "smart-todo-empty",
        text: this.activeTab === "completed" ? "Nothing completed yet." : "Nothing here. Clear."
      });
      if (this.tasks.length === 0) {
        empty.createDiv({
          cls: "smart-todo-empty-scope",
          text: `Watching ${describeScope(this.plugin.scope)}`
        });
      }
      return;
    }
    for (const task of tasks) {
      this.renderRow(this.listEl, task, today);
    }
  }
  renderRow(parent, task, today) {
    var _a;
    const row = parent.createDiv({ cls: "smart-todo-row" });
    if (task.status === "done")
      row.addClass("is-done");
    if (task.due && task.due.getTime() < today.getTime() && task.status === "open") {
      row.addClass("is-overdue");
    }
    if (isResting(task, today))
      row.addClass("is-resting");
    const checkbox = row.createEl("input", {
      cls: "smart-todo-checkbox",
      attr: { type: "checkbox" }
    });
    checkbox.checked = task.status === "done";
    checkbox.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      checkbox.disabled = true;
      const ok = await safeWrite(
        () => toggleTaskDone(this.app, task, task.status === "open")
      );
      if (!ok)
        checkbox.checked = task.status === "done";
      await this.refresh();
    });
    const main = row.createDiv({ cls: "smart-todo-main" });
    const titleEl = main.createDiv({
      cls: "smart-todo-title",
      text: task.title || "(untitled task)"
    });
    titleEl.addEventListener("click", () => void this.revealTask(task));
    titleEl.setAttr("title", `${task.filePath}:${task.lineNumber + 1}`);
    const meta = main.createDiv({ cls: "smart-todo-meta" });
    if (task.due) {
      meta.createSpan({
        cls: "smart-todo-date",
        text: this.humanDate(task.due, today)
      });
    }
    if (isResting(task, today)) {
      meta.createSpan({
        cls: "smart-todo-date is-defer",
        text: `rests until ${this.humanDate(task.defer, today)}`
      });
    }
    const effortLabel = task.effort ? task.effort.charAt(0).toUpperCase() + task.effort.slice(1) : "Effort";
    const pill = meta.createSpan({
      cls: `smart-todo-effort is-${(_a = task.effort) != null ? _a : "unset"}`,
      text: effortLabel,
      attr: { "aria-label": "Set effort" }
    });
    const openMenu = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.showEffortMenu(evt, task);
    };
    pill.addEventListener("click", openMenu);
    pill.addEventListener("contextmenu", openMenu);
    if (task.pushes > 0) {
      meta.createSpan({
        cls: "smart-todo-pushes",
        text: `\u21BB ${task.pushes}`,
        attr: {
          "aria-label": `Pushed ${task.pushes} ${task.pushes === 1 ? "time" : "times"}`
        }
      });
    }
    if (task.project) {
      meta.createSpan({ cls: "smart-todo-project", text: task.project });
    }
    if (task.assigned) {
      meta.createSpan({ cls: "smart-todo-assigned", text: `@${task.assigned}` });
    }
    if (task.status === "done" && task.doneDate) {
      meta.createSpan({
        cls: "smart-todo-date",
        text: `done ${formatDate(task.doneDate)}`
      });
    }
    if (task.status === "open") {
      const pushBtn = row.createEl("button", {
        cls: "smart-todo-push",
        attr: { "aria-label": "Push 1 day" }
      });
      (0, import_obsidian4.setIcon)(pushBtn, "chevrons-right");
      pushBtn.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        pushBtn.disabled = true;
        await safeWrite(() => pushTask(this.app, task, 1));
        await this.refresh();
      });
    }
  }
  showEffortMenu(evt, task) {
    const menu = new import_obsidian4.Menu();
    for (const effort of EFFORTS) {
      menu.addItem(
        (item) => item.setTitle(effort.charAt(0).toUpperCase() + effort.slice(1)).setChecked(task.effort === effort).onClick(async () => {
          await safeWrite(() => setTaskEffort(this.app, task, effort));
          await this.refresh();
        })
      );
    }
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle("Clear effort").onClick(async () => {
        await safeWrite(() => setTaskEffort(this.app, task, null));
        await this.refresh();
      })
    );
    menu.showAtMouseEvent(evt);
  }
  /** Open the source note and park the cursor on the task's line. */
  async revealTask(task) {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(
      this.app.vault.getAbstractFileByPath(task.filePath),
      { eState: { line: task.lineNumber } }
    );
  }
  humanDate(date, today) {
    if (!date)
      return "";
    if (isSameDay(date, today))
      return "Today";
    if (isSameDay(date, addDays(today, 1)))
      return "Tomorrow";
    if (isSameDay(date, addDays(today, -1)))
      return "Yesterday";
    const days = Math.round((date.getTime() - today.getTime()) / 864e5);
    if (days < 0)
      return `${formatDate(date)} (${Math.abs(days)}d late)`;
    if (days <= 6) {
      return date.toLocaleDateString(void 0, { weekday: "short" });
    }
    return formatDate(date);
  }
};

// src/main.ts
var REFRESH_DEBOUNCE_MS = 1200;
var SmartTodoPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.refreshTimer = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(
      VIEW_TYPE_SMART_TODO,
      (leaf) => new SmartTodoView(leaf, this)
    );
    this.addSettingTab(new SmartTodoSettingTab(this.app, this));
    this.addRibbonIcon("list-checks", "Smart ToDo: Today", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open-today-view",
      name: "Open Today view",
      callback: () => void this.activateView()
    });
    this.addCommand({
      id: "add-task",
      name: "Add task",
      callback: () => {
        new AddTaskModal(this.app, (title) => void this.addTask(title)).open();
      }
    });
    this.addCommand({
      id: "refresh-tasks",
      name: "Rescan tasks",
      callback: () => this.refreshViews()
    });
    this.app.workspace.onLayoutReady(() => {
      void this.ensurePrimaryFile();
    });
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian5.TFile && this.isInManagedScope(file.path)) {
          this.scheduleRefresh();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (this.isInManagedScope(file.path))
          this.scheduleRefresh();
      })
    );
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
  }
  onunload() {
    if (this.refreshTimer)
      clearTimeout(this.refreshTimer);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /** The managed scope as currently configured. */
  get scope() {
    return parseScope(this.settings.managedFiles);
  }
  isInManagedScope(path) {
    return isInScope(path, this.scope);
  }
  /** The file new tasks are appended to. */
  get primaryFile() {
    return primaryManagedFile(this.scope);
  }
  async scan() {
    return scanScope(this.app, this.scope);
  }
  /** Create the managed file if it's missing, so capture always has a target. */
  async ensurePrimaryFile() {
    const path = this.primaryFile;
    if (this.app.vault.getAbstractFileByPath(path))
      return;
    try {
      await ensureManagedFile(this.app, path);
      new import_obsidian5.Notice(`Smart ToDo: created ${path}`, 4e3);
    } catch (e) {
      console.error("[smart-todo] could not create managed file", path, e);
    }
  }
  /** Capture a task title into the managed file. */
  async addTask(title) {
    const trimmed = title.trim();
    if (!trimmed)
      return false;
    const ok = await safeWrite(() => appendTask(this.app, this.primaryFile, trimmed));
    if (ok)
      this.refreshViews();
    return ok;
  }
  scheduleRefresh() {
    if (this.refreshTimer)
      clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refreshViews();
    }, REFRESH_DEBOUNCE_MS);
  }
  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SMART_TODO)) {
      const view = leaf.view;
      if (view instanceof SmartTodoView)
        void view.refresh();
    }
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SMART_TODO);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf)
      return;
    await leaf.setViewState({ type: VIEW_TYPE_SMART_TODO, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
};
