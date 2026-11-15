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
var import_obsidian7 = require("obsidian");

// src/types.ts
var EFFORTS = ["light", "moderate", "heavy"];
var EFFORT_WEIGHT = {
  heavy: 3,
  moderate: 2,
  light: 1
};
var EFFORT_LABEL = {
  light: "Quickie",
  moderate: "Moderate",
  heavy: "Heavy"
};
var QUICKIE_HEADING = "Quickies \xB7 3 minutes or less";
var QUADRANTS = [
  { id: "do", urgent: true, important: true, label: "Do", advice: "Do now" },
  { id: "schedule", urgent: false, important: true, label: "Schedule", advice: "Decide when" },
  { id: "delegate", urgent: true, important: false, label: "Delegate", advice: "Delegate / quick-win" },
  { id: "drop", urgent: false, important: false, label: "Drop", advice: "Drop or defer" }
];
function quadrantFor(urgent, important) {
  if (urgent && important)
    return "do";
  if (!urgent && important)
    return "schedule";
  if (urgent && !important)
    return "delegate";
  return "drop";
}
var QUADRANT_COLOR = {
  do: "hsl(4, 72%, 54%)",
  // red — fire
  schedule: "hsl(210, 68%, 54%)",
  // blue — plan
  delegate: "hsl(38, 82%, 52%)",
  // amber — hand off
  drop: "hsl(220, 9%, 55%)"
  // grey — let go
};
var DEFAULT_MANAGED_FILE = "Tasks.md";
var DEFAULT_SETTINGS = {
  managedFiles: DEFAULT_MANAGED_FILE,
  pushesWarnThreshold: 3,
  defaultLayout: "card",
  groupQuickies: true
};
var CATEGORIES = ["betaworks", "personal", "health"];
var CATEGORY_LABEL = {
  betaworks: "Betaworks",
  personal: "Personal",
  health: "Health"
};
var CATEGORY_COLOR = {
  betaworks: "hsl(212, 70%, 55%)",
  // blue — work
  personal: "hsl(150, 50%, 46%)",
  // green — life
  health: "hsl(28, 80%, 55%)"
  // amber — body
};
var CATEGORY_ALIASES = {
  betaworks: "betaworks",
  investing: "betaworks",
  investment: "betaworks",
  portfolio: "betaworks",
  deals: "betaworks",
  work: "betaworks",
  research: "betaworks",
  camp: "betaworks",
  lp: "betaworks",
  health: "health",
  fitness: "health",
  medical: "health",
  doctor: "health",
  personal: "personal",
  family: "personal",
  home: "personal",
  relationships: "personal",
  reading: "personal",
  finance: "personal",
  money: "personal",
  admin: "personal",
  botwick: "personal",
  "smart todo": "personal"
};
function asCategory(raw) {
  if (!raw)
    return null;
  const v = raw.trim().toLowerCase();
  return CATEGORIES.includes(v) ? v : null;
}
function categoryFor(raw) {
  var _a, _b;
  if (!raw)
    return null;
  const v = raw.trim().toLowerCase();
  if (!v)
    return null;
  return (_b = (_a = asCategory(v)) != null ? _a : CATEGORY_ALIASES[v]) != null ? _b : "personal";
}
var TABS = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This Week" },
  { id: "overdue", label: "Overdue" },
  { id: "backlog", label: "Backlog" },
  { id: "completed", label: "Completed" },
  { id: "assigned", label: "Assigned" }
];
var QUAD_FILTERS = [
  { id: "all", label: "All" },
  { id: "do", label: "Urgent & Important" },
  { id: "schedule", label: "Important \xB7 Not urgent" },
  { id: "delegate", label: "Urgent \xB7 Not important" },
  { id: "drop", label: "Neither" },
  { id: "urgent", label: "Just Urgent" },
  { id: "important", label: "Just Important" },
  { id: "unjudged", label: "Needs review" }
];
function projectColor(project) {
  let hash = 0;
  for (let i = 0; i < project.length; i++) {
    hash = (hash * 31 + project.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 60%, 55%)`;
}
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
var EMOJI_DATE_TOKEN_RE = /(?:📅|⏳|✅|🛫|➕|❌)\s*\d{4}-\d{2}-\d{2}/g;
var RECURRENCE_TOKEN_RE = /🔁[^[\]📅⏳✅🛫➕❌🔺⏫🔼🔽⏬]*/gu;
var PRIORITY_EMOJI_RE = /[🔺⏫🔼🔽⏬]/gu;
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
function normalizeImportant(value) {
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "yes" || v === "1" || v === "high")
    return true;
  if (v === "false" || v === "no" || v === "0" || v === "low")
    return false;
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
  return body.replace(new RegExp(INLINE_FIELD_RE.source, "g"), "").replace(EMOJI_DATE_TOKEN_RE, "").replace(RECURRENCE_TOKEN_RE, "").replace(PRIORITY_EMOJI_RE, "").replace(/\s+/g, " ").trim();
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
    assigned: fields["assigned"] || null,
    important: fields["important"] !== void 0 ? normalizeImportant(fields["important"]) : null
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
      content = await app.vault.read(file);
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
    el.createEl("h3", { text: "Display" });
    new import_obsidian.Setting(el).setName("Default layout").setDesc("Card rows, or an Onda-style sortable table.").addDropdown(
      (dd) => dd.addOption("card", "Cards").addOption("table", "Table").setValue(this.plugin.settings.defaultLayout).onChange(async (value) => {
        this.plugin.settings.defaultLayout = value;
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      })
    );
    new import_obsidian.Setting(el).setName("Pushes warning threshold").setDesc(
      "The pushes badge turns amber at or above this count \u2014 your procrastination signal. Set higher to only flag chronic avoiders."
    ).addText(
      (text) => text.setValue(String(this.plugin.settings.pushesWarnThreshold)).onChange(async (value) => {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 1) {
          this.plugin.settings.pushesWarnThreshold = Math.floor(n);
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }
      })
    );
    new import_obsidian.Setting(el).setName("Group Quickies").setDesc(
      'Collect light-effort tasks into a "Quickies \xB7 3 minutes or less" section at the foot of the list. Effort is still tagged on every task either way \u2014 this only changes what the panel shows.'
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.groupQuickies).onChange(async (value) => {
        this.plugin.settings.groupQuickies = value;
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      })
    );
    el.createEl("h3", { text: "Categories" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Tasks carry one of three categories \u2014 Betaworks, Personal, Health \u2014 stored in the same [project:: \u2026] field, so Dataview and Tasks queries keep working. Imported tasks with older project names can be folded onto the three in one pass; you'll see every change first."
    });
    new import_obsidian.Setting(el).setName("Fold projects into categories").setDesc(
      "Previews the retag, then applies it one line at a time. Tasks with no project are left alone."
    ).addButton(
      (btn) => btn.setButtonText("Review changes").onClick(() => void this.plugin.openCategoryMigration())
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
function buildImportantLine(task, important) {
  return important === null ? removeInlineField(task.rawText, "important") : setInlineField(task.rawText, "important", important ? "true" : "false");
}
async function setTaskImportant(app, task, important) {
  await replaceTaskLine(app, task, buildImportantLine(task, important));
}
function buildProjectLine(task, project) {
  const trimmed = project == null ? void 0 : project.trim();
  return !trimmed ? removeInlineField(task.rawText, "project") : setInlineField(task.rawText, "project", trimmed);
}
async function setTaskProject(app, task, project) {
  await replaceTaskLine(app, task, buildProjectLine(task, project));
}
var LINE_PREFIX_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s*)/;
var DATE_EMOJI = "\u{1F4C5}\u23F3\u2705\u{1F6EB}\u2795\u274C";
var PRIORITY_EMOJI = "\u{1F53A}\u23EB\u{1F53C}\u{1F53D}\u23EC";
var TOKEN_RE = new RegExp(
  [
    // [key:: value]
    String.raw`\[[A-Za-z][\w-]*\s*::\s*[^\]]*\]`,
    // 🔁 every week  (free text, stops at the next token or end of line)
    `\u{1F501}[^\\[\\]${DATE_EMOJI}${PRIORITY_EMOJI}]*`,
    // 📅 2026-11-20
    `[${DATE_EMOJI}]\\s*\\d{4}-\\d{2}-\\d{2}`,
    // ⏫
    `[${PRIORITY_EMOJI}]`
  ].join("|"),
  "gu"
);
function buildRetitledLine(task, title) {
  var _a;
  const trimmed = title.trim();
  if (!trimmed)
    throw new StaleTaskError("Task title can't be empty.");
  const prefixMatch = LINE_PREFIX_RE.exec(task.rawText);
  if (!prefixMatch)
    throw new StaleTaskError("Not a task line; refusing to rewrite.");
  const prefix = prefixMatch[1];
  const body = task.rawText.slice(prefix.length);
  const tokens = ((_a = body.match(TOKEN_RE)) != null ? _a : []).map((t) => t.trim()).filter((t) => t.length > 0);
  return [prefix + trimmed, ...tokens].join(" ").replace(/\s+$/, "");
}
function buildPatchedLine(task, patch) {
  var _a;
  let line = task.rawText;
  if (patch.title !== void 0) {
    line = buildRetitledLine(task, patch.title);
  }
  if (patch.due !== void 0) {
    line = patch.due === null ? removeEmojiDate(line, DUE_RE) : setEmojiDate(line, "\u{1F4C5}", DUE_RE, patch.due);
  }
  if (patch.defer !== void 0) {
    line = patch.defer === null ? removeEmojiDate(line, DEFER_RE) : setEmojiDate(line, "\u23F3", DEFER_RE, patch.defer);
  }
  if (patch.effort !== void 0) {
    line = patch.effort === null ? removeInlineField(line, "effort") : setInlineField(line, "effort", patch.effort);
  }
  if (patch.project !== void 0) {
    const trimmed = (_a = patch.project) == null ? void 0 : _a.trim();
    line = !trimmed ? removeInlineField(line, "project") : setInlineField(line, "project", trimmed);
  }
  if (patch.important !== void 0) {
    line = patch.important === null ? removeInlineField(line, "important") : setInlineField(line, "important", patch.important ? "true" : "false");
  }
  if (patch.pushes !== void 0) {
    line = patch.pushes <= 0 ? removeInlineField(line, "pushes") : setInlineField(line, "pushes", String(patch.pushes));
  }
  return line.replace(/\s+$/, "");
}
async function applyTaskPatch(app, task, patch) {
  const next = buildPatchedLine(task, patch);
  if (next === task.rawText)
    return;
  await replaceTaskLine(app, task, next);
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

// src/nlparse.ts
var WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];
var WEEKDAY_ALIASES = {
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  weds: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6
};
var MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december"
];
function nextWeekday(from, target, forceNext) {
  let delta = (target - from.getDay() + 7) % 7;
  if (delta === 0 && forceNext)
    delta = 7;
  return addDays(from, delta);
}
function findDatePhrase(text) {
  const today = startOfToday();
  const patterns = [
    // today / tonight
    {
      re: /\b(today|tonight)\b/i,
      resolve: () => today
    },
    // tomorrow / tmrw
    {
      re: /\b(tomorrow|tmrw|tmr)\b/i,
      resolve: () => addDays(today, 1)
    },
    // yesterday (rare for a todo, but keep the title clean if used)
    {
      re: /\byesterday\b/i,
      resolve: () => addDays(today, -1)
    },
    // in N days / weeks
    {
      re: /\bin\s+(\d{1,3})\s+(day|days|week|weeks)\b/i,
      resolve: (m) => {
        const n = Number(m[1]);
        const unit = m[2].toLowerCase();
        return addDays(today, unit.startsWith("week") ? n * 7 : n);
      }
    },
    // next week
    {
      re: /\bnext\s+week\b/i,
      resolve: () => addDays(today, 7)
    },
    // next/this/on/by/starting/available/from <weekday> / bare <weekday>
    {
      re: /\b(next|this|on|by|starting|available|from)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)\b/i,
      resolve: (m) => {
        var _a;
        const qualifier = (m[1] || "").toLowerCase();
        const word = m[2].toLowerCase();
        let idx = WEEKDAYS.indexOf(word);
        if (idx === -1)
          idx = (_a = WEEKDAY_ALIASES[word]) != null ? _a : -1;
        if (idx === -1)
          return null;
        return nextWeekday(today, idx, qualifier === "next");
      }
    },
    // on <month> <day> / <month> <day>
    {
      re: /\b(?:on|by|due)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
      resolve: (m) => {
        const mon = m[1].toLowerCase();
        let mi = MONTHS.indexOf(mon);
        if (mi === -1)
          mi = MONTHS.findIndex((x) => x.startsWith(mon));
        if (mi === -1)
          return null;
        const day = Number(m[2]);
        let year = today.getFullYear();
        let candidate = new Date(year, mi, day);
        if (candidate.getTime() < today.getTime()) {
          candidate = new Date(year + 1, mi, day);
        }
        if (candidate.getMonth() !== mi || candidate.getDate() !== day)
          return null;
        return candidate;
      }
    },
    // ISO date embedded in prose
    {
      re: /\b(\d{4}-\d{2}-\d{2})\b/,
      resolve: (m) => parseDate(m[1])
    }
  ];
  for (const { re, resolve } of patterns) {
    const m = text.match(re);
    if (!m)
      continue;
    const date = resolve(m);
    if (!date)
      continue;
    return { date, phrase: m[0] };
  }
  return null;
}
function stripPhrase(text, phrase) {
  let out = text.replace(phrase, " ");
  out = out.replace(/\s+(on|by|due|at|for|starting|available|from)\s*$/i, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}
var EFFORT_RE = /\b(heavy|hard|big|moderate|medium|light|easy|quick|small)\b/i;
var EFFORT_MAP = {
  heavy: "heavy",
  hard: "heavy",
  big: "heavy",
  moderate: "moderate",
  medium: "moderate",
  light: "light",
  easy: "light",
  quick: "light",
  small: "light"
};
function parseNaturalTask(input) {
  var _a;
  let working = input.trim();
  let effort = null;
  let project = null;
  let assigned = null;
  let defer = null;
  const projTag = working.match(/#([A-Za-z0-9][\w-]*)/);
  const projKey = working.match(/\bproject[:\s]+([A-Za-z0-9][\w -]*?)(?=\s*(?:,|;|$|#|@|\bfor\b|\bdue\b|\bby\b))/i);
  if (projTag) {
    project = projTag[1];
    working = stripPhrase(working, projTag[0]);
  } else if (projKey) {
    project = projKey[1].trim();
    working = stripPhrase(working, projKey[0]);
  }
  const asgTag = working.match(/@([A-Za-z0-9][\w-]*)/);
  const asgFor = working.match(/\bfor\s+([A-Z][a-z]+)\b/);
  if (asgTag) {
    assigned = asgTag[1];
    working = stripPhrase(working, asgTag[0]);
  } else if (asgFor) {
    assigned = asgFor[1];
    working = stripPhrase(working, asgFor[0]);
  }
  const eff = working.match(EFFORT_RE);
  if (eff) {
    effort = (_a = EFFORT_MAP[eff[1].toLowerCase()]) != null ? _a : null;
    if (effort)
      working = stripPhrase(working, eff[0]);
  }
  const deferLead = working.match(/\b(starting|available|from|defer(?:red)?(?:\s+to)?)\s+(.+)$/i);
  if (deferLead) {
    const hit = findDatePhrase(deferLead[2]);
    if (hit) {
      defer = hit.date;
      working = stripPhrase(working, `${deferLead[1]} ${hit.phrase}`);
    }
  }
  const dueHit = findDatePhrase(working);
  let due = null;
  let matched = null;
  if (dueHit) {
    due = dueHit.date;
    matched = dueHit.phrase.trim();
    working = stripPhrase(working, dueHit.phrase);
  }
  const title = working.length > 0 ? working : input.trim();
  return { title, due, defer, effort, project, assigned, matched };
}
function parseCapture(app, input) {
  var _a, _b, _c, _d;
  const built = parseNaturalTask(input);
  const nld = (_b = (_a = app.plugins) == null ? void 0 : _a.plugins) == null ? void 0 : _b["nldates-obsidian"];
  if (built.due && built.matched && nld && typeof nld.parseDate === "function") {
    try {
      const parsed = nld.parseDate(built.matched);
      if ((_d = (_c = parsed == null ? void 0 : parsed.moment) == null ? void 0 : _c.isValid) == null ? void 0 : _d.call(_c)) {
        const d = parsed.moment.toDate();
        built.due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    } catch (e) {
    }
  }
  return built;
}
function buildCaptureBody(app, input) {
  const { title, due, defer, effort, project, assigned } = parseCapture(app, input);
  let body = title;
  if (due)
    body += ` \u{1F4C5} ${formatDate(due)}`;
  if (defer)
    body += ` \u23F3 ${formatDate(defer)}`;
  if (effort)
    body += ` [effort:: ${effort}]`;
  if (project)
    body += ` [project:: ${project}]`;
  if (assigned)
    body += ` [assigned:: ${assigned}]`;
  return body.trim() || input.trim();
}

// src/view.ts
var import_obsidian5 = require("obsidian");

// src/filters.ts
var URGENT_WINDOW_DAYS = 2;
function isResting(task, today = startOfToday()) {
  return !!task.defer && task.defer.getTime() > today.getTime();
}
function isOverdue(task, today = startOfToday()) {
  return task.status === "open" && !!task.due && task.due.getTime() < today.getTime();
}
function isDueToday(task, today = startOfToday()) {
  return task.status === "open" && !!task.due && isSameDay(task.due, today);
}
function isUrgent(task, today = startOfToday()) {
  if (!task.due)
    return false;
  if (isResting(task, today))
    return false;
  const horizon = addDays(today, URGENT_WINDOW_DAYS);
  return task.due.getTime() <= horizon.getTime();
}
function isImportant(task) {
  return task.important === true;
}
function isUnjudged(task) {
  return task.important === null;
}
function quadrantOf(task, today = startOfToday()) {
  return quadrantFor(isUrgent(task, today), isImportant(task));
}
function matchesQuadFilter(task, filter, today = startOfToday()) {
  if (filter === "all")
    return true;
  const urgent = isUrgent(task, today);
  const important = isImportant(task);
  switch (filter) {
    case "do":
      return urgent && important;
    case "schedule":
      return !urgent && important;
    case "delegate":
      return urgent && !important;
    case "drop":
      return !urgent && !important && !isUnjudged(task);
    case "urgent":
      return urgent;
    case "important":
      return important;
    case "unjudged":
      return isUnjudged(task);
    default:
      return true;
  }
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
function bucketFor(tasks, tab, today = startOfToday(), quad = "all") {
  const scoped = quad === "all" ? tasks : tasks.filter((t) => matchesQuadFilter(t, quad, today));
  const open = scoped.filter((t) => t.status === "open");
  const weekEnd = addDays(today, 6);
  let selected;
  const tomorrow = addDays(today, 1);
  switch (tab) {
    case "today":
      selected = open.filter(
        (t) => !isResting(t, today) && !!t.due && t.due.getTime() <= today.getTime()
      );
      break;
    case "tomorrow":
      selected = open.filter(
        (t) => !isResting(t, tomorrow) && !!t.due && isSameDay(t.due, tomorrow)
      );
      break;
    case "assigned":
      selected = scoped.filter((t) => !!t.assigned);
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
      selected = scoped.filter((t) => t.status === "done");
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

// src/edit-task-modal.ts
var import_obsidian4 = require("obsidian");
function dateInputValue(date) {
  return date ? formatDate(date) : "";
}
var EditTaskModal = class extends import_obsidian4.Modal {
  constructor(app, task, onSubmit, onReveal) {
    super(app);
    this.task = task;
    this.onSubmit = onSubmit;
    this.onReveal = onReveal;
    this.draft = {
      title: task.title,
      due: task.due,
      defer: task.defer,
      effort: task.effort,
      // A legacy free-text project folds onto a category for display, but
      // nothing is written unless the user actually picks one — opening the
      // editor and cancelling must not silently rewrite the line.
      category: categoryFor(task.project),
      important: task.important,
      pushes: task.pushes
    };
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("smart-todo-edit-modal");
    contentEl.empty();
    contentEl.createEl("h3", { text: "Edit task" });
    const titleInput = this.field(contentEl, "Task").createEl("input", {
      cls: "smart-todo-edit-input",
      attr: { type: "text" }
    });
    titleInput.value = this.draft.title;
    titleInput.addEventListener("input", () => {
      this.draft.title = titleInput.value;
    });
    titleInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        void this.submit();
      }
    });
    const catRow = this.field(contentEl, "Category").createDiv({
      cls: "smart-todo-seg"
    });
    const catBtns = /* @__PURE__ */ new Map();
    const paintCats = () => {
      for (const [value, btn] of catBtns) {
        btn.toggleClass("is-active", this.draft.category === value);
      }
    };
    for (const cat of CATEGORIES) {
      const btn = catRow.createEl("button", {
        cls: "smart-todo-seg-btn",
        text: CATEGORY_LABEL[cat]
      });
      btn.style.setProperty("--cat-color", CATEGORY_COLOR[cat]);
      btn.addEventListener("click", () => {
        this.draft.category = cat;
        paintCats();
      });
      catBtns.set(cat, btn);
    }
    const clearCat = catRow.createEl("button", {
      cls: "smart-todo-seg-btn is-clear",
      text: "None"
    });
    clearCat.addEventListener("click", () => {
      this.draft.category = null;
      paintCats();
    });
    catBtns.set(null, clearCat);
    paintCats();
    const legacy = this.task.project;
    if (legacy && !CATEGORIES.includes(legacy.toLowerCase())) {
      catRow.createDiv({
        cls: "smart-todo-edit-hint",
        text: `was "${legacy}"`
      });
    }
    const impRow = this.field(
      contentEl,
      "Important"
    ).createDiv({ cls: "smart-todo-seg" });
    const impOptions = [
      { value: true, label: "Yes" },
      { value: false, label: "No" },
      { value: null, label: "Not judged" }
    ];
    const impBtns = [];
    const paintImp = () => {
      for (const [value, btn] of impBtns) {
        btn.toggleClass("is-active", this.draft.important === value);
      }
    };
    for (const opt of impOptions) {
      const btn = impRow.createEl("button", {
        cls: "smart-todo-seg-btn",
        text: opt.label
      });
      btn.addEventListener("click", () => {
        this.draft.important = opt.value;
        paintImp();
      });
      impBtns.push([opt.value, btn]);
    }
    paintImp();
    this.hint(
      contentEl,
      "Important = it moves something you actually care about, or someone else is blocked on it. Routine admin is not important, even when it's expensive or overdue."
    );
    const effRow = this.field(contentEl, "Effort").createDiv({
      cls: "smart-todo-seg"
    });
    const effBtns = [];
    const paintEff = () => {
      for (const [value, btn] of effBtns) {
        btn.toggleClass("is-active", this.draft.effort === value);
      }
    };
    for (const eff of EFFORTS) {
      const btn = effRow.createEl("button", {
        cls: `smart-todo-seg-btn is-effort-${eff}`,
        text: EFFORT_LABEL[eff]
      });
      btn.addEventListener("click", () => {
        this.draft.effort = eff;
        paintEff();
      });
      effBtns.push([eff, btn]);
    }
    const clearEff = effRow.createEl("button", {
      cls: "smart-todo-seg-btn is-clear",
      text: "None"
    });
    clearEff.addEventListener("click", () => {
      this.draft.effort = null;
      paintEff();
    });
    effBtns.push([null, clearEff]);
    paintEff();
    const dueWrap = this.field(contentEl, "Due");
    const dueInput = dueWrap.createEl("input", {
      cls: "smart-todo-edit-date",
      attr: { type: "date" }
    });
    dueInput.value = dateInputValue(this.draft.due);
    dueInput.addEventListener("change", () => {
      this.draft.due = dueInput.value ? parseDate(dueInput.value) : null;
    });
    this.quickDates(dueWrap, (date) => {
      this.draft.due = date;
      dueInput.value = dateInputValue(date);
    });
    const deferWrap = this.field(contentEl, "Rest until");
    const deferInput = deferWrap.createEl("input", {
      cls: "smart-todo-edit-date",
      attr: { type: "date" }
    });
    deferInput.value = dateInputValue(this.draft.defer);
    deferInput.addEventListener("change", () => {
      this.draft.defer = deferInput.value ? parseDate(deferInput.value) : null;
    });
    this.hint(
      deferWrap,
      "Hidden from Today and This Week until this date. Use it to park something without deleting it."
    );
    if (this.task.pushes > 0) {
      const pushWrap = this.field(
        contentEl,
        `Pushed ${this.task.pushes}\xD7`
      );
      const reset = pushWrap.createEl("button", {
        cls: "smart-todo-seg-btn",
        text: "Reset counter"
      });
      reset.addEventListener("click", () => {
        this.draft.pushes = 0;
        reset.setText("Will reset to 0");
        reset.addClass("is-active");
      });
    }
    const actions = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
    const reveal = actions.createEl("button", {
      cls: "smart-todo-edit-reveal",
      text: "Open in note"
    });
    (0, import_obsidian4.setIcon)(reveal.createSpan({ cls: "smart-todo-edit-reveal-icon" }), "file-text");
    reveal.addEventListener("click", () => {
      this.close();
      this.onReveal();
    });
    const spacer = actions.createDiv({ cls: "smart-todo-modal-spacer" });
    spacer.setText("");
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", { cls: "mod-cta", text: "Save" });
    save.addEventListener("click", () => void this.submit());
    titleInput.focus();
    titleInput.select();
  }
  /** Today / Tomorrow / +1w / Clear shortcuts under the due field. */
  quickDates(parent, set) {
    const row = parent.createDiv({ cls: "smart-todo-quickdates" });
    const today = startOfToday();
    const opts = [
      { label: "Today", date: today },
      { label: "Tomorrow", date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) },
      { label: "+1 week", date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7) },
      { label: "Clear", date: null }
    ];
    for (const opt of opts) {
      const btn = row.createEl("button", {
        cls: "smart-todo-quickdate",
        text: opt.label
      });
      btn.addEventListener("click", () => set(opt.date));
    }
  }
  field(parent, label) {
    const wrap = parent.createDiv({ cls: "smart-todo-edit-field" });
    wrap.createDiv({ cls: "smart-todo-edit-label", text: label });
    return wrap;
  }
  hint(parent, text) {
    parent.createDiv({ cls: "smart-todo-edit-hint", text });
  }
  /**
   * Build the patch from what actually changed. Sending only diffs means an
   * untouched field can't be rewritten (or dropped) by opening the editor.
   */
  async submit() {
    var _a, _b, _c;
    const patch = {};
    const d = this.draft;
    const t = this.task;
    if (!d.title.trim()) {
      new import_obsidian4.Notice("Smart ToDo: a task needs a title.", 4e3);
      return;
    }
    if (d.title.trim() !== t.title)
      patch.title = d.title.trim();
    const sameDay = (a, b) => a === null || b === null ? a === b : a.getTime() === b.getTime();
    if (!sameDay(d.due, t.due))
      patch.due = d.due;
    if (!sameDay(d.defer, t.defer))
      patch.defer = d.defer;
    if (d.effort !== t.effort)
      patch.effort = d.effort;
    if (d.important !== t.important)
      patch.important = d.important;
    if (d.pushes !== t.pushes)
      patch.pushes = d.pushes;
    const currentCanonical = (_b = (_a = t.project) == null ? void 0 : _a.trim().toLowerCase()) != null ? _b : null;
    if (((_c = d.category) != null ? _c : null) !== currentCanonical)
      patch.project = d.category;
    this.close();
    await this.onSubmit(patch);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/view.ts
var SmartTodoView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.activeTab = "today";
    this.activeQuad = "all";
    this.matrixView = false;
    this.tasks = [];
    this.loading = false;
    this.layout = "card";
    this.sort = null;
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
    this.layout = this.plugin.settings.defaultLayout;
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("smart-todo-root");
    const header = root.createDiv({ cls: "smart-todo-header" });
    this.tabBarEl = header.createDiv({ cls: "smart-todo-tabs" });
    const actions = header.createDiv({ cls: "smart-todo-header-actions" });
    const matrixBtn = actions.createEl("button", {
      cls: "smart-todo-matrix-toggle",
      attr: { "aria-label": "Toggle Eisenhower matrix" }
    });
    const paintMatrixBtn = () => {
      (0, import_obsidian5.setIcon)(matrixBtn, "layout-grid");
      matrixBtn.toggleClass("is-active", this.matrixView);
    };
    paintMatrixBtn();
    matrixBtn.addEventListener("click", () => {
      this.matrixView = !this.matrixView;
      paintMatrixBtn();
      this.render();
    });
    const layoutBtn = actions.createEl("button", {
      cls: "smart-todo-layout-toggle",
      attr: { "aria-label": "Toggle card / table layout" }
    });
    const paintLayoutBtn = () => (0, import_obsidian5.setIcon)(layoutBtn, this.layout === "table" ? "list" : "table");
    paintLayoutBtn();
    layoutBtn.addEventListener("click", () => {
      this.layout = this.layout === "table" ? "card" : "table";
      paintLayoutBtn();
      this.render();
    });
    const refreshBtn = actions.createEl("button", {
      cls: "smart-todo-refresh",
      attr: { "aria-label": "Rescan vault" }
    });
    (0, import_obsidian5.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => void this.refresh());
    this.quadBarEl = root.createDiv({ cls: "smart-todo-quadbar" });
    this.renderAddRow(root);
    this.summaryEl = root.createDiv({ cls: "smart-todo-summary" });
    this.listEl = root.createDiv({ cls: "smart-todo-list" });
    this.renderTabs();
    this.renderQuadFilters();
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
    this.renderQuadFilters();
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
    (0, import_obsidian5.setIcon)(addBtn, "plus");
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
        void this.refresh();
      });
    }
  }
  /**
   * The Eisenhower filter row. Each button carries a live count of how many
   * open tasks in the current tab land in that slice — so the bar doubles as a
   * matrix review: you can see at a glance that "Urgent & Important" is 9 and
   * "Needs review" is 40 without clicking anything.
   */
  renderQuadFilters() {
    if (!this.quadBarEl)
      return;
    this.quadBarEl.empty();
    const today = startOfToday();
    const tabSet = bucketFor(this.tasks, this.activeTab, today, "all").tasks;
    for (const f of QUAD_FILTERS) {
      const count = f.id === "all" ? tabSet.length : tabSet.filter((t) => this.quadFilterMatch(t, f.id, today)).length;
      const btn = this.quadBarEl.createEl("button", {
        cls: "smart-todo-quad-btn"
      });
      btn.createSpan({ cls: "smart-todo-quad-label", text: f.label });
      btn.createSpan({ cls: "smart-todo-quad-count", text: String(count) });
      if (f.id === this.activeQuad)
        btn.addClass("is-active");
      if (count === 0 && f.id !== "all")
        btn.addClass("is-empty");
      btn.addEventListener("click", () => {
        this.activeQuad = f.id;
        this.renderQuadFilters();
        this.render();
      });
    }
  }
  /** Thin wrapper so the view doesn't re-import the predicate guts. */
  quadFilterMatch(task, id, today) {
    const urgent = isUrgent(task, today);
    const important = task.important === true;
    const unjudged = isUnjudged(task);
    switch (id) {
      case "do":
        return urgent && important;
      case "schedule":
        return !urgent && important;
      case "delegate":
        return urgent && !important;
      case "drop":
        return !urgent && !important && !unjudged;
      case "urgent":
        return urgent;
      case "important":
        return important;
      case "unjudged":
        return unjudged;
      default:
        return true;
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
    const quad = this.matrixView ? "all" : this.activeQuad;
    const { tasks, restingCount } = bucketFor(
      this.tasks,
      this.activeTab,
      today,
      quad
    );
    const countLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
    this.summaryEl.createSpan({ cls: "smart-todo-count", text: countLabel });
    if (!this.matrixView && this.activeQuad !== "all") {
      const def = QUAD_FILTERS.find((f) => f.id === this.activeQuad);
      if (def) {
        this.summaryEl.createSpan({
          cls: "smart-todo-filter-tag",
          text: `\xB7 ${def.label}`
        });
      }
    }
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
    const ordered = this.applySort(tasks, today);
    if (this.matrixView) {
      this.renderMatrix(this.listEl, ordered, today);
    } else if (this.layout === "table") {
      this.renderTable(this.listEl, ordered, today);
    } else if (this.quickiesGrouped()) {
      this.renderGroupedCards(this.listEl, ordered, today);
    } else {
      for (const task of ordered) {
        this.renderRow(this.listEl, task, today);
      }
    }
  }
  /**
   * Card list with light-effort tasks pulled out into their own section at the
   * foot: "Quickies · 3 minutes or less".
   *
   * The real work and the five-things-you-can-knock-off-now are different
   * decisions, and interleaving them meant the quick ones padded the list and
   * made Today look worse than it was. Separating them also gives the batch a
   * name — "do the quickies" is a thing you can actually act on.
   */
  renderGroupedCards(parent, tasks, today) {
    const quickies = tasks.filter((t) => t.effort === "light");
    const rest = tasks.filter((t) => t.effort !== "light");
    for (const task of rest)
      this.renderRow(parent, task, today);
    if (quickies.length === 0)
      return;
    if (rest.length > 0) {
      const head = parent.createDiv({ cls: "smart-todo-group-head" });
      head.createSpan({ cls: "smart-todo-group-title", text: QUICKIE_HEADING });
      head.createSpan({
        cls: "smart-todo-group-tally",
        text: String(quickies.length)
      });
    }
    const body = parent.createDiv({ cls: "smart-todo-group-body" });
    for (const task of quickies)
      this.renderRow(body, task, today);
  }
  /**
   * The 2×2 Eisenhower grid: four quadrant cells, each holding the compact
   * rows that fall in it. Urgent on the left column, Important on the top row,
   * so Q1 (Do) sits top-left where the eye lands first.
   */
  renderMatrix(parent, tasks, today) {
    const grid = parent.createDiv({ cls: "smart-todo-matrix" });
    const byQuad = {
      do: [],
      schedule: [],
      delegate: [],
      drop: []
    };
    for (const t of tasks)
      byQuad[quadrantOf(t, today)].push(t);
    const order = ["do", "schedule", "delegate", "drop"];
    for (const q of order) {
      const def = QUADRANTS.find((d) => d.id === q);
      const cell = grid.createDiv({ cls: `smart-todo-quad-cell is-${q}` });
      cell.style.setProperty("--quad-color", QUADRANT_COLOR[q]);
      const head = cell.createDiv({ cls: "smart-todo-quad-head" });
      head.createSpan({ cls: "smart-todo-quad-title", text: def.label });
      head.createSpan({
        cls: "smart-todo-quad-advice",
        text: def.advice
      });
      head.createSpan({
        cls: "smart-todo-quad-tally",
        text: String(byQuad[q].length)
      });
      const body = cell.createDiv({ cls: "smart-todo-quad-body" });
      if (byQuad[q].length === 0) {
        body.createDiv({ cls: "smart-todo-quad-empty", text: "\u2014" });
        continue;
      }
      for (const task of byQuad[q]) {
        this.renderRow(body, task, today);
      }
    }
  }
  /**
   * In table layout the user drives the sort via column headers. In card layout
   * (or table with no explicit sort chosen) we keep the smart triage order the
   * bucket already produced.
   */
  applySort(tasks, today) {
    if (this.layout !== "table" || !this.sort)
      return tasks;
    const { key, dir } = this.sort;
    const mul = dir === "asc" ? 1 : -1;
    const quadRank = {
      do: 0,
      schedule: 1,
      delegate: 2,
      drop: 3
    };
    const val = (t) => {
      var _a;
      switch (key) {
        case "due":
          return t.due ? t.due.getTime() : Number.POSITIVE_INFINITY;
        case "pushes":
          return t.pushes;
        case "effort":
          return t.effort ? EFFORT_WEIGHT[t.effort] : 0;
        case "project":
          return ((_a = t.project) != null ? _a : "").toLowerCase();
        case "quadrant":
          return quadRank[quadrantOf(t, today)];
        default:
          return t.title.toLowerCase();
      }
    };
    return [...tasks].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv)
        return -1 * mul;
      if (av > bv)
        return 1 * mul;
      return 0;
    });
  }
  renderRow(parent, task, today) {
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
    const titleRow = main.createDiv({ cls: "smart-todo-title-row" });
    this.renderImportanceToggle(titleRow, task);
    const titleEl = titleRow.createDiv({
      cls: "smart-todo-title",
      text: task.title || "(untitled task)"
    });
    titleEl.addEventListener("click", () => this.openEditor(task));
    titleEl.setAttr("title", `Click to edit \xB7 ${task.filePath}:${task.lineNumber + 1}`);
    const meta = main.createDiv({ cls: "smart-todo-meta" });
    if (task.status === "open") {
      const q = quadrantOf(task, today);
      const def = QUADRANTS.find((d) => d.id === q);
      const qpill = meta.createSpan({
        cls: `smart-todo-quadpill is-${q}`,
        text: def.label,
        attr: { "aria-label": `${def.label} \u2014 ${def.advice}` }
      });
      qpill.style.setProperty("--quad-color", QUADRANT_COLOR[q]);
      if (isUnjudged(task))
        qpill.addClass("is-unjudged");
    }
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
    if (task.effort === "light" && !this.quickiesGrouped()) {
      const pill = meta.createSpan({
        cls: "smart-todo-effort is-light",
        text: EFFORT_LABEL.light,
        attr: { "aria-label": "3 minutes or less" }
      });
      const openMenu = (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        this.showEffortMenu(evt, task);
      };
      pill.addEventListener("click", openMenu);
      pill.addEventListener("contextmenu", openMenu);
    }
    if (task.pushes > 0) {
      const warn = task.pushes >= this.plugin.settings.pushesWarnThreshold;
      meta.createSpan({
        cls: `smart-todo-pushes${warn ? " is-warn" : ""}`,
        text: `\u21BB ${task.pushes}`,
        attr: {
          "aria-label": `Pushed ${task.pushes} ${task.pushes === 1 ? "time" : "times"}`
        }
      });
    }
    this.renderCategory(meta, task);
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
      (0, import_obsidian5.setIcon)(pushBtn, "chevrons-right");
      pushBtn.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        pushBtn.disabled = true;
        await safeWrite(() => pushTask(this.app, task, 1));
        await this.refresh();
      });
    }
  }
  /**
   * Importance star. Three states cycle on click:
   *   unjudged (?) → important (★) → not important (☆) → unjudged
   * Right-click clears straight back to unjudged. This is the one control that
   * sets the "important" axis; urgency is never set by hand.
   */
  renderImportanceToggle(parent, task) {
    const state = task.important === true ? "yes" : task.important === false ? "no" : "unjudged";
    const star = parent.createSpan({
      cls: `smart-todo-star is-${state}`,
      attr: {
        "aria-label": state === "yes" ? "Important \u2014 click to mark not important" : state === "no" ? "Not important \u2014 click to clear" : "Importance not set \u2014 click to mark important"
      }
    });
    (0, import_obsidian5.setIcon)(star, state === "yes" ? "star" : state === "no" ? "star-off" : "help-circle");
    const cycle = async () => {
      const next = task.important === null ? true : task.important === true ? false : null;
      await safeWrite(() => setTaskImportant(this.app, task, next));
      await this.refresh();
    };
    star.addEventListener("click", (evt) => {
      evt.stopPropagation();
      void cycle();
    });
    star.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void safeWrite(() => setTaskImportant(this.app, task, null)).then(
        () => this.refresh()
      );
    });
  }
  showEffortMenu(evt, task) {
    const menu = new import_obsidian5.Menu();
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
  /**
   * Category chip: a colored dot + name, or a faint "+ Category" affordance
   * when unset. Click opens a three-item menu — Betaworks / Personal / Health
   * — because the whole point of collapsing eleven free-text projects into
   * three categories is that picking one should never need typing.
   *
   * A legacy, un-migrated value still renders under its own hashed color so
   * it's visibly *not* one of the three until it's folded.
   */
  renderCategory(parent, task) {
    const chip = parent.createSpan({ cls: "smart-todo-project" });
    const canonical = asCategory(task.project);
    if (canonical) {
      chip.createSpan({
        cls: "smart-todo-project-dot",
        attr: { style: `background:${CATEGORY_COLOR[canonical]}` }
      });
      chip.createSpan({
        cls: "smart-todo-project-name",
        text: CATEGORY_LABEL[canonical]
      });
    } else if (task.project) {
      chip.addClass("is-legacy");
      chip.createSpan({
        cls: "smart-todo-project-dot",
        attr: { style: `background:${projectColor(task.project)}` }
      });
      chip.createSpan({ cls: "smart-todo-project-name", text: task.project });
      chip.setAttr("aria-label", "Not one of the three categories \u2014 click to set");
    } else {
      chip.addClass("is-unset");
      chip.setText("+ Category");
    }
    chip.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.showCategoryMenu(evt, task);
    });
  }
  showCategoryMenu(evt, task) {
    const current = asCategory(task.project);
    const menu = new import_obsidian5.Menu();
    for (const cat of CATEGORIES) {
      menu.addItem(
        (item) => item.setTitle(CATEGORY_LABEL[cat]).setChecked(current === cat).onClick(async () => {
          await safeWrite(() => setTaskProject(this.app, task, cat));
          await this.refresh();
        })
      );
    }
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle("Clear category").onClick(async () => {
        await safeWrite(() => setTaskProject(this.app, task, null));
        await this.refresh();
      })
    );
    menu.showAtMouseEvent(evt);
  }
  /** Open the full editor for a task and write back whatever changed. */
  openEditor(task) {
    new EditTaskModal(
      this.app,
      task,
      async (patch) => {
        if (Object.keys(patch).length === 0)
          return;
        await safeWrite(() => applyTaskPatch(this.app, task, patch));
        await this.refresh();
      },
      () => void this.revealTask(task)
    ).open();
  }
  /** Is the Quickies section active for the current layout? */
  quickiesGrouped() {
    return this.plugin.settings.groupQuickies && this.layout === "card" && !this.matrixView;
  }
  /** Onda-style table: sortable headers + one row per task. */
  renderTable(parent, tasks, today) {
    var _a;
    const table = parent.createEl("table", { cls: "smart-todo-table" });
    const thead = table.createEl("thead");
    const headRow = thead.createEl("tr");
    const cols = [
      { key: "title", label: "Task" },
      { key: "quadrant", label: "Priority" },
      { key: "due", label: "Due" },
      { key: "pushes", label: "Pushes" },
      { key: "effort", label: "Effort" },
      { key: "project", label: "Project" }
    ];
    for (const col of cols) {
      const th = headRow.createEl("th", { cls: "smart-todo-th", text: col.label });
      if (((_a = this.sort) == null ? void 0 : _a.key) === col.key) {
        th.addClass("is-sorted");
        th.createSpan({
          cls: "smart-todo-sort-caret",
          text: this.sort.dir === "asc" ? " \u25B2" : " \u25BC"
        });
      }
      th.addEventListener("click", () => {
        var _a2;
        if (((_a2 = this.sort) == null ? void 0 : _a2.key) === col.key) {
          this.sort = {
            key: col.key,
            dir: this.sort.dir === "asc" ? "desc" : "asc"
          };
        } else {
          this.sort = { key: col.key, dir: "asc" };
        }
        this.render();
      });
    }
    const tbody = table.createEl("tbody");
    for (const task of tasks) {
      const tr = tbody.createEl("tr", { cls: "smart-todo-trow" });
      if (task.status === "done")
        tr.addClass("is-done");
      if (task.due && task.due.getTime() < today.getTime() && task.status === "open") {
        tr.addClass("is-overdue");
      }
      const titleTd = tr.createEl("td", { cls: "smart-todo-td-title" });
      const cb = titleTd.createEl("input", {
        attr: { type: "checkbox" },
        cls: "smart-todo-checkbox"
      });
      cb.checked = task.status === "done";
      cb.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        cb.disabled = true;
        await safeWrite(
          () => toggleTaskDone(this.app, task, task.status === "open")
        );
        await this.refresh();
      });
      const titleSpan = titleTd.createSpan({
        cls: "smart-todo-title",
        text: task.title || "(untitled task)"
      });
      titleSpan.addEventListener("click", () => this.openEditor(task));
      const quadTd = tr.createEl("td", { cls: "smart-todo-td-quadrant" });
      this.renderImportanceToggle(quadTd, task);
      if (task.status === "open") {
        const q = quadrantOf(task, today);
        const def = QUADRANTS.find((d) => d.id === q);
        const qpill = quadTd.createSpan({
          cls: `smart-todo-quadpill is-${q}`,
          text: def.label,
          attr: { "aria-label": def.advice }
        });
        qpill.style.setProperty("--quad-color", QUADRANT_COLOR[q]);
        if (isUnjudged(task))
          qpill.addClass("is-unjudged");
      } else {
        quadTd.createSpan({ cls: "smart-todo-quad-na", text: "\u2014" });
      }
      const dueTd = tr.createEl("td", { cls: "smart-todo-td-due" });
      dueTd.setText(task.due ? this.humanDate(task.due, today) : "\u2014");
      const pushTd = tr.createEl("td", { cls: "smart-todo-td-pushes" });
      if (task.pushes > 0) {
        const warn = task.pushes >= this.plugin.settings.pushesWarnThreshold;
        pushTd.createSpan({
          cls: `smart-todo-pushes${warn ? " is-warn" : ""}`,
          text: String(task.pushes)
        });
      } else {
        pushTd.setText("\u2014");
      }
      const effTd = tr.createEl("td", { cls: "smart-todo-td-effort" });
      if (task.effort === "light") {
        const effPill = effTd.createSpan({
          cls: "smart-todo-effort is-light",
          text: EFFORT_LABEL.light
        });
        effPill.addEventListener("click", (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          this.showEffortMenu(evt, task);
        });
      } else {
        effTd.setText("\u2014");
      }
      const projTd = tr.createEl("td", { cls: "smart-todo-td-project" });
      this.renderCategory(projTd, task);
    }
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

// src/categorize.ts
var import_obsidian6 = require("obsidian");
function planCategoryMigration(tasks) {
  var _a;
  const changes = [];
  for (const task of tasks) {
    const raw = (_a = task.project) == null ? void 0 : _a.trim();
    if (!raw)
      continue;
    if (asCategory(raw))
      continue;
    const to = categoryFor(raw);
    if (!to)
      continue;
    changes.push({ task, from: raw, to });
  }
  return changes;
}
function groupPlan(changes) {
  var _a, _b;
  const byTarget = /* @__PURE__ */ new Map();
  for (const c of changes) {
    const inner = (_a = byTarget.get(c.to)) != null ? _a : /* @__PURE__ */ new Map();
    inner.set(c.from, ((_b = inner.get(c.from)) != null ? _b : 0) + 1);
    byTarget.set(c.to, inner);
  }
  return CATEGORIES.filter((cat) => byTarget.has(cat)).map((cat) => ({
    to: cat,
    froms: Array.from(byTarget.get(cat).entries()).map(([from, count]) => ({ from, count })).sort((a, b) => b.count - a.count || a.from.localeCompare(b.from))
  }));
}
var CategoryMigrationModal = class extends import_obsidian6.Modal {
  constructor(app, changes, onApply) {
    super(app);
    this.changes = changes;
    this.onApply = onApply;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Fold projects into categories" });
    if (this.changes.length === 0) {
      contentEl.createDiv({
        cls: "smart-todo-edit-hint",
        text: "Every tagged task already uses Betaworks, Personal or Health. Nothing to do."
      });
      const done = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
      const close = done.createEl("button", { cls: "mod-cta", text: "Close" });
      close.addEventListener("click", () => this.close());
      return;
    }
    contentEl.createDiv({
      cls: "smart-todo-edit-hint",
      text: `${this.changes.length} task${this.changes.length === 1 ? "" : "s"} will be retagged. Tasks with no project are left untouched.`
    });
    const list = contentEl.createDiv({ cls: "smart-todo-migrate-list" });
    for (const group of groupPlan(this.changes)) {
      const row = list.createDiv({ cls: "smart-todo-migrate-group" });
      const head = row.createDiv({ cls: "smart-todo-migrate-head" });
      head.createSpan({
        cls: "smart-todo-project-dot",
        attr: { style: `background:${CATEGORY_COLOR[group.to]}` }
      });
      head.createSpan({
        cls: "smart-todo-migrate-target",
        text: CATEGORY_LABEL[group.to]
      });
      const froms = row.createDiv({ cls: "smart-todo-migrate-froms" });
      for (const f of group.froms) {
        froms.createDiv({
          cls: "smart-todo-migrate-from",
          text: `${f.from} \u2192 ${f.count}`
        });
      }
    }
    const actions = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", {
      cls: "mod-cta",
      text: `Retag ${this.changes.length}`
    });
    apply.addEventListener("click", () => {
      this.close();
      void this.onApply();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
var REFRESH_DEBOUNCE_MS = 250;
var SmartTodoPlugin = class extends import_obsidian7.Plugin {
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
    this.addCommand({
      id: "migrate-categories",
      name: "Fold projects into categories (Betaworks / Personal / Health)",
      callback: () => void this.openCategoryMigration()
    });
    this.app.workspace.onLayoutReady(() => {
      void this.ensurePrimaryFile();
    });
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian7.TFile && this.isInManagedScope(file.path)) {
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
      new import_obsidian7.Notice(`Smart ToDo: created ${path}`, 4e3);
    } catch (e) {
      console.error("[smart-todo] could not create managed file", path, e);
    }
  }
  /**
   * Capture a task from natural language into the managed file. "Buy the milk
   * tomorrow" becomes "Buy the milk 📅 <tomorrow>" — the date phrase is parsed
   * out and the title left clean. Plain titles with no date phrase pass through
   * unchanged.
   */
  async addTask(title) {
    const trimmed = title.trim();
    if (!trimmed)
      return false;
    const body = buildCaptureBody(this.app, trimmed);
    const ok = await safeWrite(() => appendTask(this.app, this.primaryFile, body));
    if (ok)
      this.refreshViews();
    return ok;
  }
  /**
   * Preview, then apply, the project → category fold.
   *
   * Writes run one line at a time through `setTaskProject`, sequentially: each
   * call re-verifies the line it's replacing, and only one line changes per
   * write, so a concurrent edit elsewhere in the file can't be clobbered and a
   * mid-run failure leaves the earlier tasks correctly retagged.
   */
  async openCategoryMigration() {
    const tasks = await this.scan();
    const changes = planCategoryMigration(tasks);
    new CategoryMigrationModal(this.app, changes, async () => {
      let applied = 0;
      for (const change of changes) {
        const ok = await safeWrite(
          () => setTaskProject(this.app, change.task, change.to)
        );
        if (!ok)
          break;
        applied++;
      }
      new import_obsidian7.Notice(
        `Smart ToDo: retagged ${applied} of ${changes.length} task${changes.length === 1 ? "" : "s"}.`,
        5e3
      );
      this.refreshViews();
    }).open();
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
