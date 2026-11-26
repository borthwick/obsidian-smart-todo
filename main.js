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
var import_obsidian12 = require("obsidian");

// src/types.ts
var PRIORITY_MARK = {
  highest: "\u{1F53A}",
  high: "\u23EB",
  medium: "\u{1F53C}",
  low: "\u{1F53D}",
  lowest: "\u23EC"
};
var DEFAULT_IMPORTANT_HEADINGS = [
  "important",
  "urgent",
  "focus this week",
  "priorities",
  "priority"
];
var EFFORTS = ["light", "moderate", "heavy", "deep"];
var EFFORT_WEIGHT = {
  deep: 4,
  heavy: 3,
  moderate: 2,
  light: 1
};
var EFFORT_LABEL = {
  light: "3 min",
  moderate: "15 min",
  heavy: "1 hour",
  deep: "Deep work"
};
var EFFORT_MINUTES = {
  light: 3,
  moderate: 15,
  heavy: 60,
  deep: 120
};
var EFFORT_BLURB = {
  light: "Clear them in one sitting",
  moderate: "Between meetings",
  heavy: "Needs a block",
  deep: "More than an hour"
};
var BUDGETS = [
  { id: "3m", label: "3 min", fits: ["light"] },
  { id: "15m", label: "15 min", fits: ["light", "moderate"] },
  { id: "1h", label: "1 hour", fits: ["light", "moderate", "heavy"] },
  { id: "any", label: "Any", fits: ["light", "moderate", "heavy", "deep"] }
];
var MODES = [
  { id: "focus", label: "Focus", icon: "sun" },
  { id: "sweep", label: "Sweep", icon: "zap" },
  { id: "lanes", label: "Lanes", icon: "columns-3" }
];
var HORIZONS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
  // "All" means all the work in play, not every line in the vault: a task
  // deferred past DEFER_HORIZON_DAYS is parked, and parked work in the main
  // list is noise you have to re-skip every time you look. Deferred is where
  // it goes, and it's one menu item away rather than a setting.
  { id: "deferred", label: "Deferred" },
  { id: "done", label: "Done" }
];
var QUADRANTS = [
  { id: "do", urgent: true, important: true, label: "Do first", advice: "Urgent and important" },
  { id: "schedule", urgent: false, important: true, label: "Schedule", advice: "Important, not urgent" },
  { id: "delegate", urgent: true, important: false, label: "Delegate", advice: "Urgent, not important" },
  { id: "drop", urgent: false, important: false, label: "Drop", advice: "Neither \u2014 let it go" }
];
var QUADRANT_ORDER = ["do", "schedule", "delegate", "drop"];
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
  do: "#b65259",
  // urgent red — fire
  schedule: "hsl(240, 18%, 51%)",
  // #6B6B99 — plan
  delegate: "hsl(36, 100%, 48%)",
  // OmniFocus flag orange — hand off
  drop: "hsl(220, 9%, 55%)"
  // grey — let go
};
var ACCENTS = {
  // #6B6B99 — John's OmniFocus title indigo, converted to HSL so the strong
  // variant is a pure lightness step rather than a second eyeballed hex.
  omnifocus: {
    label: "OmniFocus indigo",
    base: "hsl(240, 18%, 51%)",
    strong: "hsl(240, 22%, 38%)"
  },
  blue: { label: "Blue", base: "hsl(214, 72%, 42%)", strong: "hsl(214, 78%, 32%)" },
  green: { label: "Forest green", base: "hsl(149, 61%, 20%)", strong: "hsl(149, 61%, 14%)" },
  slate: { label: "Slate", base: "hsl(215, 25%, 35%)", strong: "hsl(215, 28%, 25%)" }
};
function applyAccentVars(el, accent) {
  var _a2;
  const def = (_a2 = ACCENTS[accent]) != null ? _a2 : ACCENTS.omnifocus;
  el.style.setProperty("--stw-accent", def.base);
  el.style.setProperty("--stw-accent-strong", def.strong);
}
var DEFAULT_MANAGED_FILE = "Tasks.md";
var DEFAULT_SETTINGS = {
  managedFiles: DEFAULT_MANAGED_FILE,
  inboxFile: "",
  pushesWarnThreshold: 3,
  defaultLayout: "card",
  groupQuickies: true,
  accent: "omnifocus",
  defaultMode: "focus",
  sweepSeconds: 180,
  showSweepBanner: true,
  sourceLabels: {},
  collapsedSources: [],
  weekTokensEnabled: true,
  weekStart: "sunday",
  importantHeadings: [...DEFAULT_IMPORTANT_HEADINGS],
  groupByHeading: true,
  metadataChips: true,
  inlineSuggest: "everywhere"
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
  var _a2, _b;
  if (!raw)
    return null;
  const v = raw.trim().toLowerCase();
  if (!v)
    return null;
  return (_b = (_a2 = asCategory(v)) != null ? _a2 : CATEGORY_ALIASES[v]) != null ? _b : "personal";
}
function projectColor(project) {
  let hash = 0;
  for (let i = 0; i < project.length; i++) {
    hash = (hash * 31 + project.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 60%, 55%)`;
}
var VIEW_TYPE_SMART_TODO = "smart-todo-view";

// src/scope.ts
function weekNumber(date, weekStart = "sunday") {
  if (weekStart === "monday") {
    const d2 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = (d2.getDay() + 6) % 7;
    d2.setDate(d2.getDate() - dow + 3);
    const firstThursday = new Date(d2.getFullYear(), 0, 4);
    const fdow = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - fdow + 3);
    return 1 + Math.round((d2.getTime() - firstThursday.getTime()) / (7 * 864e5));
  }
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekOneStart = new Date(jan1);
  weekOneStart.setDate(jan1.getDate() - jan1.getDay());
  return 1 + Math.floor((d.getTime() - weekOneStart.getTime()) / (7 * 864e5));
}
function weekYear(date, weekStart = "sunday") {
  if (weekStart !== "monday")
    return date.getFullYear();
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + 3);
  return d.getFullYear();
}
function expandPathTokens(path, today = new Date(), weekStart = "sunday") {
  if (!path.includes("{{"))
    return path;
  const week = weekNumber(today, weekStart);
  return path.replace(/\{\{week:02\}\}/gi, String(week).padStart(2, "0")).replace(/\{\{week\}\}/gi, String(week)).replace(/\{\{year\}\}/gi, String(weekYear(today, weekStart)));
}
function normalizePath(raw) {
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
}
function samePath(a, b) {
  if (!a || !b)
    return false;
  const left = normalizePath(a).toLowerCase();
  const right = normalizePath(b).toLowerCase();
  return left.length > 0 && left === right;
}
function splitScopeEntries(raw) {
  return (raw != null ? raw : "").split(/\n/).map(normalizePath).filter((p) => p.length > 0);
}
function splitHeadingSuffix(entry) {
  const m = /^(.*\.md)#(.+)$/i.exec(entry);
  if (!m)
    return { path: entry, heading: null };
  const heading = m[2].trim();
  return heading ? { path: m[1], heading } : { path: m[1], heading: null };
}
function normalizeHeading(h) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}
function headingMatches(taskHeading, needle) {
  if (!taskHeading)
    return false;
  const h = normalizeHeading(taskHeading);
  const n = normalizeHeading(needle);
  return n.length > 0 && (h === n || h.startsWith(n));
}
function parseScope(raw, options = {}) {
  const { today = new Date(), weekStart = "sunday", expandTokens = true } = options;
  const parts = splitScopeEntries(raw).map((p) => expandTokens ? expandPathTokens(p, today, weekStart) : p).filter((p) => p.length > 0 && !p.includes("{{"));
  const seen = /* @__PURE__ */ new Set();
  const entries = [];
  for (const raw2 of parts) {
    const key = raw2.toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    const { path, heading } = splitHeadingSuffix(raw2);
    entries.push({
      kind: /\.md$/i.test(path) ? "file" : "folder",
      path,
      heading: /\.md$/i.test(path) ? heading : null
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
function isTaskInScope(task, scope) {
  const p = normalizePath(task.filePath).toLowerCase();
  for (const entry of scope.entries) {
    const e = entry.path.toLowerCase();
    const fileMatches = entry.kind === "file" ? p === e : p.startsWith(`${e}/`);
    if (!fileMatches)
      continue;
    if (!entry.heading)
      return true;
    if (headingMatches(task.heading, entry.heading))
      return true;
  }
  return false;
}
function primaryManagedFile(scope) {
  const file = scope.entries.find((e) => e.kind === "file" && !e.heading);
  if (file)
    return file.path;
  const folder = scope.entries.find((e) => e.kind === "folder");
  if (folder)
    return `${folder.path}/${DEFAULT_MANAGED_FILE}`;
  return DEFAULT_MANAGED_FILE;
}
function rawEntries(raw) {
  return splitScopeEntries(raw);
}
function scopeIncludesPath(raw, path, options = {}) {
  const { today = new Date(), weekStart = "sunday" } = options;
  const needle = splitHeadingSuffix(normalizePath(path)).path.toLowerCase();
  return rawEntries(raw).some((p) => {
    const base = splitHeadingSuffix(p).path;
    return base.toLowerCase() === needle || splitHeadingSuffix(expandPathTokens(p, today, weekStart)).path.toLowerCase() === needle;
  });
}
function addPathToScope(raw, path) {
  const clean = normalizePath(path);
  if (!clean || scopeIncludesPath(raw, clean))
    return raw != null ? raw : "";
  const existing = (raw != null ? raw : "").trim();
  if (!existing)
    return clean;
  return `${existing}
${clean}`;
}
function removePathFromScope(raw, path, options = {}) {
  const { today = new Date(), weekStart = "sunday" } = options;
  const needle = splitHeadingSuffix(normalizePath(path)).path.toLowerCase();
  const kept = rawEntries(raw).filter(
    (p) => splitHeadingSuffix(p).path.toLowerCase() !== needle && splitHeadingSuffix(expandPathTokens(p, today, weekStart)).path.toLowerCase() !== needle
  );
  return kept.join("\n");
}
function splitLegacyCommaList(raw, exists) {
  const value = raw != null ? raw : "";
  if (!value.includes(","))
    return null;
  const out = [];
  for (const line of value.split(/\n/)) {
    const tokens = line.split(",");
    let i = 0;
    while (i < tokens.length) {
      let taken = 0;
      for (let end = tokens.length; end > i + 1; end--) {
        const candidate = normalizePath(tokens.slice(i, end).join(","));
        if (candidate && exists(candidate)) {
          out.push(candidate);
          taken = end - i;
          break;
        }
      }
      if (taken === 0) {
        const single = normalizePath(tokens[i]);
        if (single)
          out.push(single);
        taken = 1;
      }
      i += taken;
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const deduped = out.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
  const migrated = deduped.join("\n");
  return migrated === value ? null : migrated;
}
function describeScope(scope) {
  return scope.entries.map((e) => {
    if (e.kind === "folder")
      return `${e.path}/ (folder)`;
    return e.heading ? `${e.path} \u203A ${e.heading}` : e.path;
  }).join(", ");
}

// src/parser.ts
var TASK_LINE_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[(.)\]\s*(.*)$/;
var DONE_MARKERS = /* @__PURE__ */ new Set(["x", "X"]);
var CANCELLED_MARKERS = /* @__PURE__ */ new Set(["-"]);
var HEADING_RE = /^(#{1,6})\s+(.*)$/;
var ARCHIVE_HEADING_RE = /^archive\b/i;
function cleanHeading(raw) {
  return displayTitle(
    raw.replace(/<[^>]+>/g, "").replace(/^#+\s*/, "").replace(/\s*#+\s*$/, "")
  );
}
var DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;
var DEFER_RE = /⏳\s*(\d{4}-\d{2}-\d{2})/;
var DONE_DATE_RE = /✅\s*(\d{4}-\d{2}-\d{2})/;
var INLINE_FIELD_RE = /\[([A-Za-z][\w-]*)\s*::\s*([^\]]*)\]/g;
function readDate(fieldValue, emojiRe, body) {
  if (fieldValue !== void 0) {
    const fromField = parseDate(fieldValue.trim());
    if (fromField)
      return fromField;
  }
  const m = emojiRe.exec(body);
  return m ? parseDate(m[1]) : null;
}
var EMOJI_DATE_TOKEN_RE = /(?:📅|⏳|✅|🛫|➕|❌)\s*\d{4}-\d{2}-\d{2}/g;
var RECURRENCE_TOKEN_RE = /🔁[^[\]📅⏳✅🛫➕❌🔺⏫🔼🔽⏬]*/gu;
var TASK_ID_TOKEN_RE = /(?:🆔|⛔)\s*[A-Za-z0-9]+(?:\s*,\s*[A-Za-z0-9]+)*/gu;
var PRIORITY_EMOJI_RE = /[🔺⏫🔼🔽⏬]/gu;
var PRIORITY_BY_EMOJI = {
  "\u{1F53A}": "highest",
  "\u23EB": "high",
  "\u{1F53C}": "medium",
  "\u{1F53D}": "low",
  "\u23EC": "lowest"
};
function parsePriority(body) {
  var _a2;
  const m = new RegExp(PRIORITY_EMOJI_RE.source, "u").exec(body);
  return m ? (_a2 = PRIORITY_BY_EMOJI[m[0]]) != null ? _a2 : null : null;
}
var PRIORITY_WORDS = {
  highest: "highest",
  urgent: "highest",
  high: "high",
  medium: "medium",
  normal: "medium",
  low: "low",
  lowest: "lowest"
};
function parsePriorityWord(value) {
  var _a2;
  return (_a2 = PRIORITY_WORDS[value.trim().toLowerCase()]) != null ? _a2 : null;
}
function importanceFromPriority(p) {
  if (p === "highest" || p === "high" || p === "medium")
    return true;
  if (p === "low" || p === "lowest")
    return false;
  return null;
}
function headingImpliesImportant(heading, needles = DEFAULT_IMPORTANT_HEADINGS) {
  if (!heading)
    return false;
  const h = heading.toLowerCase();
  return needles.some((n) => n.trim().length > 0 && h.includes(n.trim().toLowerCase()));
}
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
function addMonths(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(date.getDate(), lastDay)
  );
}
function isSameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
var DURATION_RE = /^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?$/;
function parseMinutes(value) {
  const m = DURATION_RE.exec(value.trim().toLowerCase());
  if (!m)
    return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0)
    return null;
  const hours = !!m[2] && m[2].startsWith("h");
  const mins = Math.round(hours ? n * 60 : n);
  return mins > 0 ? mins : null;
}
function effortFromMinutes(mins) {
  if (mins <= 3)
    return "light";
  if (mins <= 15)
    return "moderate";
  if (mins <= 60)
    return "heavy";
  return "deep";
}
function normalizeEffort(value) {
  const v = value.trim().toLowerCase();
  if (v === "light" || v === "moderate" || v === "heavy" || v === "deep")
    return v;
  const mins = parseMinutes(v);
  return mins === null ? null : effortFromMinutes(mins);
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
  return body.replace(new RegExp(INLINE_FIELD_RE.source, "g"), "").replace(EMOJI_DATE_TOKEN_RE, "").replace(RECURRENCE_TOKEN_RE, "").replace(TASK_ID_TOKEN_RE, "").replace(PRIORITY_EMOJI_RE, "").replace(/\s+/g, " ").trim();
}
function displayTitle(title) {
  return title.replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/!?\[\[([^\]]+)\]\]/g, "$1").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*\*\*([^*]+)\*\*\*/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2").replace(/__([^_]+)__/g, "$1").replace(/==([^=]+)==/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\s+/g, " ").trim();
}
function parseTaskLine(line, filePath, lineNumber, context = {}) {
  var _a2, _b;
  const m = TASK_LINE_RE.exec(line);
  if (!m)
    return null;
  const indentRaw = m[1];
  const checkbox = m[2];
  const body = m[3];
  const fields = extractInlineFields(body);
  const due = readDate(fields["due"], DUE_RE, body);
  const defer = readDate(fields["defer"], DEFER_RE, body);
  const doneDate = readDate(fields["done"], DONE_DATE_RE, body);
  const pushesRaw = fields["pushes"];
  const pushesParsed = pushesRaw === void 0 ? NaN : parseInt(pushesRaw, 10);
  const priority = (_a2 = fields["priority"] !== void 0 ? parsePriorityWord(fields["priority"]) : null) != null ? _a2 : parsePriority(body);
  const heading = (_b = context.heading) != null ? _b : null;
  const effortMinutes = fields["effort"] !== void 0 ? parseMinutes(fields["effort"]) : null;
  let important = null;
  let importantFrom = null;
  if (fields["important"] !== void 0) {
    important = normalizeImportant(fields["important"]);
    if (important !== null)
      importantFrom = "field";
  }
  if (important === null && priority !== null) {
    important = importanceFromPriority(priority);
    if (important !== null)
      importantFrom = "priority";
  }
  if (important === null && headingImpliesImportant(heading, context.importantHeadings)) {
    important = true;
    importantFrom = "heading";
  }
  return {
    filePath,
    lineNumber,
    rawText: line,
    title: deriveTitle(body),
    status: DONE_MARKERS.has(checkbox) || CANCELLED_MARKERS.has(checkbox) ? "done" : "open",
    marker: checkbox,
    cancelled: CANCELLED_MARKERS.has(checkbox),
    // Tabs count as one level; a 4-space indent is the common alternative.
    // Only the ordering matters downstream, not the absolute number.
    indent: indentRaw.replace(/\t/g, "    ").length,
    heading,
    priority,
    importantFrom,
    due,
    defer,
    doneDate,
    dropped: fields["dropped"] ? parseDate(fields["dropped"]) : null,
    effort: fields["effort"] ? normalizeEffort(fields["effort"]) : null,
    effortMinutes,
    pushes: Number.isFinite(pushesParsed) && pushesParsed > 0 ? pushesParsed : 0,
    project: fields["project"] || null,
    assigned: fields["assigned"] || null,
    important
  };
}
function parseTasksFromContent(content, filePath, options = {}) {
  const tasks = [];
  const lines = content.split("\n");
  let heading = null;
  const ancestry = [];
  let inFence = false;
  let archived = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      heading = cleanHeading(headingMatch[2]) || null;
      ancestry.length = 0;
      archived = ARCHIVE_HEADING_RE.test(heading != null ? heading : "");
      continue;
    }
    if (archived)
      continue;
    const task = parseTaskLine(lines[i], filePath, i, {
      heading,
      importantHeadings: options.importantHeadings
    });
    if (!task)
      continue;
    while (ancestry.length > 0 && ancestry[ancestry.length - 1].indent >= task.indent) {
      ancestry.pop();
    }
    const parent = ancestry[ancestry.length - 1];
    if (parent) {
      task.parentLine = parent.lineNumber;
      if (task.important === null && parent.important !== null) {
        task.important = parent.important;
        task.importantFrom = "parent";
      }
    }
    ancestry.push(task);
    tasks.push(task);
  }
  return markParents(tasks);
}
function markParents(tasks) {
  var _a2, _b;
  const openChildren = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    if (t.parentLine === null || t.status !== "open")
      continue;
    const key = `${t.filePath}:${t.parentLine}`;
    openChildren.set(key, ((_a2 = openChildren.get(key)) != null ? _a2 : 0) + 1);
  }
  for (const t of tasks) {
    t.openChildren = (_b = openChildren.get(`${t.filePath}:${t.lineNumber}`)) != null ? _b : 0;
  }
  return tasks;
}
async function scanScope(app, scope, options = {}) {
  const files = app.vault.getMarkdownFiles().filter((file) => isInScope(file.path, scope));
  const all = [];
  for (const file of files) {
    let content;
    try {
      content = await app.vault.read(file);
    } catch (e) {
      continue;
    }
    if (!/^\s*(?:[-*+]|\d+[.)])\s+\[.\]/m.test(content))
      continue;
    all.push(
      ...parseTasksFromContent(content, file.path, options).filter(
        (t) => isTaskInScope(t, scope)
      )
    );
  }
  return all;
}

// src/metadata-chips.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var CHIP_FIELDS = {
  due: { label: "due", cls: "stw-chip-due" },
  defer: { label: "defer", cls: "stw-chip-defer" },
  done: { label: "done", cls: "stw-chip-done" },
  dropped: { label: "dropped", cls: "stw-chip-done" },
  effort: { label: "", cls: "stw-chip-effort" },
  project: { label: "", cls: "stw-chip-project" },
  priority: { label: "", cls: "stw-chip-priority" },
  important: { label: "", cls: "stw-chip-important" },
  pushes: { label: "", cls: "stw-chip-pushes" },
  assigned: { label: "", cls: "stw-chip-assigned" }
};
var ID_FIELDS = /* @__PURE__ */ new Set(["stream", "morgen", "id", "blockedBy", "blocked-by"]);
var FIELD_RE = /\[([A-Za-z][\w-]*)\s*::\s*([^\]]*)\]/g;
var EMOJI_RE = /(📅|⏳|✅|🛫|➕|❌)\s*(\d{4}-\d{2}-\d{2})|(🔺|⏫|🔼|🔽|⏬)/gu;
var EMOJI_FIELD = {
  "\u{1F4C5}": "due",
  "\u23F3": "defer",
  "\u2705": "done",
  "\u{1F6EB}": "start",
  "\u2795": "added",
  "\u274C": "cancelled"
};
var EMOJI_PRIORITY = {
  "\u{1F53A}": "highest",
  "\u23EB": "high",
  "\u{1F53C}": "medium",
  "\u{1F53D}": "low",
  "\u23EC": "lowest"
};
function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m)
    return iso;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime()))
    return iso;
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(void 0, {
    month: "short",
    day: "numeric",
    ...sameYear ? {} : { year: "numeric" }
  });
}
function fieldChip(key, value, raw) {
  const lower = key.toLowerCase();
  const v = value.trim();
  if (ID_FIELDS.has(key) || ID_FIELDS.has(lower)) {
    return { text: "", title: raw, cls: "stw-chip-id" };
  }
  const def = CHIP_FIELDS[lower];
  if (!def)
    return null;
  if (lower === "important") {
    const on = /^(true|yes|1)$/i.test(v);
    return {
      text: on ? "important" : "not important",
      title: raw,
      cls: on ? "stw-chip-important" : "stw-chip-unimportant"
    };
  }
  if (lower === "pushes") {
    return { text: `\u21BB${v}`, title: raw, cls: def.cls };
  }
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const shown = isDate ? shortDate(v) : v;
  return {
    text: def.label ? `${def.label} ${shown}` : shown,
    title: raw,
    cls: def.cls
  };
}
var ChipWidget = class extends import_view.WidgetType {
  constructor(spec) {
    super();
    this.spec = spec;
  }
  /**
   * Two chips are interchangeable when they'd render identically. CodeMirror
   * reuses the DOM when this returns true, so without it every keystroke on
   * the line rebuilds every chip on it.
   */
  eq(other) {
    return other.spec.text === this.spec.text && other.spec.cls === this.spec.cls && other.spec.title === this.spec.title;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `stw-chip ${this.spec.cls}`;
    el.setAttr("title", this.spec.title);
    if (this.spec.text) {
      el.textContent = this.spec.text;
    } else {
      el.addClass("stw-chip-dot");
    }
    return el;
  }
  /**
   * Let clicks through to the editor so clicking a chip puts the cursor on the
   * line — which reveals the raw text. That's the whole interaction: click to
   * see what's really there.
   */
  ignoreEvent() {
    return false;
  }
};
function chipsForLine(text, from, out) {
  FIELD_RE.lastIndex = 0;
  let m;
  while (m = FIELD_RE.exec(text)) {
    const spec = fieldChip(m[1], m[2], m[0]);
    if (spec)
      out.push({ start: from + m.index, end: from + m.index + m[0].length, spec });
  }
  EMOJI_RE.lastIndex = 0;
  while (m = EMOJI_RE.exec(text)) {
    const spec = m[3] ? { text: EMOJI_PRIORITY[m[3]], title: m[0], cls: "stw-chip-priority" } : {
      text: `${EMOJI_FIELD[m[1]]} ${shortDate(m[2])}`,
      title: m[0],
      cls: `stw-chip-${EMOJI_FIELD[m[1]]}`
    };
    out.push({ start: from + m.index, end: from + m.index + m[0].length, spec });
  }
}
var TASK_LINE_RE2 = /^\s*(?:[-*+]|\d+[.)])\s+\[.\]\s/;
function buildDecorations(view) {
  const builder = new import_state.RangeSetBuilder();
  const sel = view.state.selection;
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      pos = line.to + 1;
      if (!TASK_LINE_RE2.test(line.text))
        continue;
      const touched = sel.ranges.some((r) => r.from <= line.to && r.to >= line.from);
      if (touched)
        continue;
      const ranges = [];
      chipsForLine(line.text, line.from, ranges);
      ranges.sort((a, b) => a.start - b.start);
      for (const r of ranges) {
        builder.add(r.start, r.end, import_view.Decoration.replace({ widget: new ChipWidget(r.spec) }));
      }
    }
  }
  return builder.finish();
}
function metadataChipsExtension() {
  return import_view.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildDecorations(view);
      }
      update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}

// src/archive-modal.ts
var import_obsidian = require("obsidian");
var ArchiveBacklogModal = class extends import_obsidian.Modal {
  constructor(app, path, count, samples, onApply) {
    super(app);
    this.path = path;
    this.count = count;
    this.samples = samples;
    this.onApply = onApply;
  }
  onOpen() {
    var _a2;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Archive the backlog" });
    const name = (_a2 = this.path.split("/").pop()) != null ? _a2 : this.path;
    if (this.count === 0) {
      contentEl.createDiv({
        cls: "smart-todo-edit-hint",
        text: `No open tasks in ${name}. Nothing to archive.`
      });
      const done = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
      done.createEl("button", { cls: "mod-cta", text: "Close" }).addEventListener("click", () => this.close());
      return;
    }
    contentEl.createDiv({
      cls: "smart-todo-edit-hint",
      text: `${this.count} open task${this.count === 1 ? "" : "s"} in ${name} will move to an "## Archive" section at the foot of the note, stamped with today's date. Sub-tasks travel with their parent.`
    });
    contentEl.createDiv({
      cls: "smart-todo-edit-hint",
      text: "Nothing is deleted and nothing is marked done \u2014 the lines keep their text, dates and ids, they just stop showing in the panel. To bring one back, cut it out of the Archive section."
    });
    if (this.samples.length > 0) {
      const list = contentEl.createDiv({ cls: "smart-todo-migrate-list" });
      for (const title of this.samples) {
        list.createDiv({ cls: "smart-todo-migrate-from", text: title });
      }
      if (this.count > this.samples.length) {
        list.createDiv({
          cls: "smart-todo-edit-hint",
          text: `\u2026and ${this.count - this.samples.length} more.`
        });
      }
    }
    const actions = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
    actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const apply = actions.createEl("button", {
      cls: "mod-cta",
      text: `Archive ${this.count}`
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

// src/heading-scope-modal.ts
var import_obsidian4 = require("obsidian");

// src/task-suggest.ts
var import_obsidian3 = require("obsidian");

// src/writer.ts
var import_obsidian2 = require("obsidian");
var StaleTaskError = class extends Error {
};
function getFile(app, path) {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof import_obsidian2.TFile)) {
    throw new StaleTaskError(`File no longer exists: ${path}`);
  }
  return file;
}
async function processFile(app, file, mutate) {
  const vault = app.vault;
  if (typeof vault.process === "function") {
    await vault.process(file, mutate);
  } else {
    const content = await app.vault.read(file);
    await app.vault.modify(file, mutate(content));
  }
}
function locateTaskLine(lines, task) {
  if (lines[task.lineNumber] === task.rawText)
    return task.lineNumber;
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
  return matches[0];
}
async function replaceTaskLine(app, task, newLine) {
  const file = getFile(app, task.filePath);
  await processFile(app, file, (content) => {
    const lines = content.split("\n");
    lines[locateTaskLine(lines, task)] = newLine;
    return lines.join("\n");
  });
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
function removeEmojiDate(line, re) {
  return line.replace(new RegExp(`\\s*${re.source}`), "");
}
function setDateField(line, key, emojiRe, date) {
  return setInlineField(removeEmojiDate(line, emojiRe), key, formatDate(date));
}
function clearDateField(line, key, emojiRe) {
  return removeInlineField(removeEmojiDate(line, emojiRe), key);
}
function setCheckbox(line, done) {
  return line.replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+\[).(\])/,
    `$1${done ? "x" : " "}$2`
  );
}
function buildToggledLine(task, nowDone) {
  const line = setCheckbox(task.rawText, nowDone);
  return nowDone ? setDateField(line, "done", DONE_DATE_RE, startOfToday()) : clearDateField(line, "done", DONE_DATE_RE);
}
async function toggleTaskDone(app, task, nowDone) {
  await replaceTaskLine(app, task, buildToggledLine(task, nowDone));
}
function pushTargetDate(task, days = 1, today = startOfToday()) {
  var _a2;
  const anchor = (_a2 = task.due) != null ? _a2 : task.defer;
  const from = anchor && anchor.getTime() > today.getTime() ? anchor : today;
  return addDays(from, days);
}
function buildPushedLine(task, days = 1) {
  const today = startOfToday();
  const target = pushTargetDate(task, days, today);
  let line = task.rawText;
  if (task.due || !task.defer) {
    line = setDateField(line, "due", DUE_RE, target);
  }
  line = setDateField(line, "defer", DEFER_RE, target);
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
var LINE_PREFIX_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[.\]\s*)/;
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
  var _a2;
  const trimmed = title.trim();
  if (!trimmed)
    throw new StaleTaskError("Task title can't be empty.");
  const prefixMatch = LINE_PREFIX_RE.exec(task.rawText);
  if (!prefixMatch)
    throw new StaleTaskError("Not a task line; refusing to rewrite.");
  const prefix = prefixMatch[1];
  const body = task.rawText.slice(prefix.length);
  const tokens = ((_a2 = body.match(TOKEN_RE)) != null ? _a2 : []).map((t) => t.trim()).filter((t) => t.length > 0);
  return [prefix + trimmed, ...tokens].join(" ").replace(/\s+$/, "");
}
function buildPatchedLine(task, patch) {
  var _a2;
  let line = task.rawText;
  if (patch.title !== void 0) {
    line = buildRetitledLine(task, patch.title);
  }
  if (patch.due !== void 0) {
    line = patch.due === null ? clearDateField(line, "due", DUE_RE) : setDateField(line, "due", DUE_RE, patch.due);
  }
  if (patch.defer !== void 0) {
    line = patch.defer === null ? clearDateField(line, "defer", DEFER_RE) : setDateField(line, "defer", DEFER_RE, patch.defer);
  }
  if (patch.effort !== void 0) {
    line = patch.effort === null ? removeInlineField(line, "effort") : setInlineField(line, "effort", patch.effort);
  }
  if (patch.project !== void 0) {
    const trimmed = (_a2 = patch.project) == null ? void 0 : _a2.trim();
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
function appendRawLine(content, line) {
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
var TRIAGE_HEADING_RE = /^(#{1,6})\s+(?:kept|triaged|inbox)\b/i;
function insertIndexFor(lines) {
  for (let i = 0; i < lines.length; i++) {
    const heading = TRIAGE_HEADING_RE.exec(lines[i]);
    if (!heading)
      continue;
    const level = heading[1].length;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const next = /^(#{1,6})\s/.exec(lines[j]);
      if (next && next[1].length <= level) {
        end = j;
        break;
      }
    }
    while (end > i + 1 && lines[end - 1].trim() === "")
      end--;
    return end;
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("```")) {
      let j = i;
      while (j > 0 && lines[j - 1].trim() === "")
        j--;
      return j;
    }
  }
  return -1;
}
function buildInsertedContent(content, line) {
  const lines = content.split("\n");
  const at = insertIndexFor(lines);
  if (at < 0)
    return appendRawLine(content, line);
  lines.splice(at, 0, line);
  return `${lines.join("\n").replace(/\n+$/, "")}
`;
}
function buildKeptContent(content, line) {
  const lines = content.split("\n");
  if (lines.some((l) => TRIAGE_HEADING_RE.test(l))) {
    return buildInsertedContent(content, line);
  }
  if (insertIndexFor(lines) < 0) {
    const sep = content.trim() ? "\n" : "";
    return appendRawLine(content, `${sep}## Kept

${line}`);
  }
  const at = insertIndexFor(lines);
  const block = ["## Kept", "", line, ""];
  if (at > 0 && lines[at - 1].trim() !== "")
    block.unshift("");
  lines.splice(at, 0, ...block);
  return `${lines.join("\n").replace(/\n+$/, "")}
`;
}
async function ensureManagedFile(app, path) {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof import_obsidian2.TFile)
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
  await processFile(
    app,
    file,
    (content) => buildInsertedContent(content, `- [ ] ${trimmed}`)
  );
}
async function moveTaskLine(app, task, targetPath, lineText = task.rawText) {
  if (samePath(task.filePath, targetPath))
    return;
  const source = getFile(app, task.filePath);
  const content = await app.vault.read(source);
  locateTaskLine(content.split("\n"), task);
  const target = await ensureManagedFile(app, targetPath);
  await processFile(app, target, (c) => buildKeptContent(c, lineText));
  try {
    await processFile(app, source, (c) => {
      const lines = c.split("\n");
      lines.splice(locateTaskLine(lines, task), 1);
      return lines.join("\n");
    });
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new StaleTaskError(
      `Copied into ${targetPath}, but couldn't remove it from ${task.filePath} \u2014 it's now in both files. Delete one by hand. (${why})`
    );
  }
}
function buildDroppedLine(task) {
  return setInlineField(
    buildToggledLine(task, true),
    "dropped",
    formatDate(startOfToday())
  );
}
async function dropTask(app, task) {
  await replaceTaskLine(app, task, buildDroppedLine(task));
}
function spanOf(lines, from, indent) {
  let end = from + 1;
  for (let i = from + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line))
      break;
    if (/^(#{1,6})\s/.test(line))
      break;
    if (line.trim() === "") {
      end = i + 1;
      continue;
    }
    if (indentWidth(line) <= indent)
      break;
    end = i + 1;
  }
  while (end > from + 1 && lines[end - 1].trim() === "")
    end--;
  return end;
}
function indentWidth(line) {
  var _a2, _b;
  const ws = (_b = (_a2 = /^[ \t]*/.exec(line)) == null ? void 0 : _a2[0]) != null ? _b : "";
  return ws.replace(/\t/g, "    ").length;
}
function buildArchivedContent(content, openLineNumbers, today = startOfToday()) {
  var _a2;
  if (openLineNumbers.length === 0)
    return { content, moved: 0 };
  const lines = content.split("\n");
  const take = /* @__PURE__ */ new Set();
  let moved = 0;
  for (const n of [...openLineNumbers].sort((a, b) => a - b)) {
    if (take.has(n) || !lines[n])
      continue;
    const end = spanOf(lines, n, indentWidth(lines[n]));
    for (let i = n; i < end; i++)
      take.add(i);
    moved++;
  }
  if (moved === 0)
    return { content, moved: 0 };
  const stamp = formatDate(today);
  const block = [];
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (!take.has(i)) {
      kept.push(lines[i]);
      continue;
    }
    block.push(
      /^\s*(?:[-*+]|\d+[.)])\s+\[.\]\s/.test(lines[i]) ? setInlineField(lines[i], "archived", stamp) : lines[i]
    );
  }
  const body = kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "");
  const existing = kept.findIndex((l) => {
    const m = /^(#{1,6})\s+(.*)$/.exec(l);
    return !!m && /^archive\b/i.test(m[2].trim());
  });
  if (existing >= 0) {
    const out = body.split("\n");
    const level = ((_a2 = /^(#{1,6})\s/.exec(out[existing])) != null ? _a2 : ["", "#"])[1].length;
    let at = out.length;
    for (let j = existing + 1; j < out.length; j++) {
      const next = /^(#{1,6})\s/.exec(out[j]);
      if (next && next[1].length <= level) {
        at = j;
        break;
      }
    }
    while (at > existing + 1 && out[at - 1].trim() === "")
      at--;
    out.splice(at, 0, ...block);
    return { content: `${out.join("\n")}
`, moved };
  }
  return {
    content: `${[body, "", "## Archive", "", ...block].join("\n")}
`,
    moved
  };
}
async function archiveOpenTasks(app, path, openLinesOf) {
  const file = getFile(app, path);
  let moved = 0;
  await processFile(app, file, (content) => {
    const result = buildArchivedContent(content, openLinesOf(content));
    moved = result.moved;
    return moved === 0 ? content : result.content;
  });
  return moved;
}
async function safeWrite(fn) {
  try {
    await fn();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    new import_obsidian2.Notice(`Smart ToDo: ${msg}`, 6e3);
    console.error("[smart-todo] write failed", e);
    return false;
  }
}

// src/filters.ts
var URGENT_WINDOW_DAYS = 2;
var DEFER_HORIZON_DAYS = 7;
function isResting(task, today = startOfToday()) {
  return !!task.defer && task.defer.getTime() > today.getTime();
}
function isParked(task, today = startOfToday()) {
  if (!task.defer)
    return false;
  return task.defer.getTime() > addDays(today, DEFER_HORIZON_DAYS).getTime();
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
function quadrantOf(task, today = startOfToday()) {
  return quadrantFor(isUrgent(task, today), isImportant(task));
}
function fitsBudget(task, budget) {
  if (budget === "any")
    return true;
  if (!task.effort)
    return false;
  const def = BUDGETS.find((b) => b.id === budget);
  return !!def && def.fits.includes(task.effort);
}
function matchesCategory(task, filter) {
  if (filter === "all")
    return true;
  return categoryFor(task.project) === filter;
}
function estimateMinutes(tasks) {
  return tasks.reduce((sum, t) => sum + (t.effort ? EFFORT_MINUTES[t.effort] : 0), 0);
}
function formatDuration(minutes) {
  if (minutes <= 0)
    return "\u2014";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0)
    return `${m}m`;
  if (m === 0)
    return `${h}h`;
  return `${h}h ${m}m`;
}
function matchesHorizon(task, horizon, today = startOfToday()) {
  if (horizon === "done")
    return task.status === "done";
  if (task.status !== "open")
    return false;
  switch (horizon) {
    case "today":
      return !isResting(task, today) && !!task.due && task.due.getTime() <= today.getTime();
    case "week": {
      const end = addDays(today, 6);
      if (task.defer && task.defer.getTime() > end.getTime())
        return false;
      return !!task.due && task.due.getTime() <= end.getTime();
    }
    case "deferred":
      return isResting(task, today);
    default:
      return !isParked(task, today);
  }
}
function matchesSearch(tasks, search) {
  const needle = search.trim().toLowerCase();
  if (!needle)
    return [];
  return tasks.filter((t) => t.title.toLowerCase().includes(needle));
}
function selectTasks(tasks, query, today = startOfToday()) {
  const needle = query.search.trim().toLowerCase();
  const everywhere = !!needle && !!query.searchEverywhere;
  const out = tasks.filter((t) => {
    if (needle && !t.title.toLowerCase().includes(needle))
      return false;
    if (everywhere)
      return true;
    if (!matchesHorizon(t, query.horizon, today))
      return false;
    if (!matchesCategory(t, query.category))
      return false;
    if (!fitsBudget(t, query.budget))
      return false;
    return true;
  });
  if (everywhere) {
    return out.sort((a, b) => {
      if (a.status !== b.status)
        return a.status === "open" ? -1 : 1;
      return a.status === "open" ? compareForToday(a, b, today) : compareCompleted(a, b);
    });
  }
  if (query.horizon === "done")
    return out.sort(compareCompleted);
  if (query.horizon === "deferred") {
    return out.sort(
      (a, b) => {
        var _a2, _b, _c, _d;
        return ((_b = (_a2 = a.defer) == null ? void 0 : _a2.getTime()) != null ? _b : 0) - ((_d = (_c = b.defer) == null ? void 0 : _c.getTime()) != null ? _d : 0);
      }
    );
  }
  return out.sort((a, b) => compareForToday(a, b, today));
}
function groupByHeading(tasks) {
  var _a2, _b;
  const sections = [];
  const index = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    const key = (_a2 = task.heading) != null ? _a2 : "\0none";
    let section = index.get(key);
    if (!section) {
      section = { heading: (_b = task.heading) != null ? _b : null, tasks: [] };
      index.set(key, section);
      sections.push(section);
    }
    section.tasks.push(task);
  }
  return sections;
}
function isContainer(task) {
  var _a2;
  return ((_a2 = task.openChildren) != null ? _a2 : 0) > 0;
}
function groupBySource(tasks, isHome) {
  const main = [];
  const byPath = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    if (isHome(task.filePath)) {
      main.push(task);
      continue;
    }
    const bucket = byPath.get(task.filePath);
    if (bucket)
      bucket.push(task);
    else
      byPath.set(task.filePath, [task]);
  }
  return {
    main,
    groups: [...byPath.entries()].map(([path, groupTasks]) => ({ path, tasks: groupTasks }))
  };
}
function groupByQuadrant(tasks, today = startOfToday()) {
  const out = { do: [], schedule: [], delegate: [], drop: [] };
  for (const t of tasks)
    out[quadrantOf(t, today)].push(t);
  return out;
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

// src/task-suggest.ts
var TASK_PREFIX_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[.\]\s*)/;
var BULLET_PREFIX_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)/;
var INDENT_RE = /^(\s*)/;
var NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
var _a;
var urgentWindow = (_a = NUMBER_WORDS[URGENT_WINDOW_DAYS]) != null ? _a : String(URGENT_WINDOW_DAYS);
var ACTIONS = [
  {
    id: "plain",
    label: "task, triage later",
    keywords: ["add", "task", "todo", "plain", "triage"]
  },
  {
    id: "important",
    label: "important",
    keywords: ["important", "priority", "high", "matters"]
  },
  {
    id: "urgent",
    label: `urgent (due in ${urgentWindow} days)`,
    keywords: ["urgent", "due", "soon", "now", "today"]
  }
];
var SPIRAL_ICON_ID = "smart-todo-spiral";
var SPIRAL_ICON_SVG = `<g transform="scale(4.1667)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12 m 0 0 c 0.5 0 1 0 1 -1 c 0 -1.5 -1.5 -1.5 -2 -1 c -1.5 1 -1.5 3.5 0.5 4 c 3 0.5 4 -3 2 -5 c -3 -3 -7 0 -6 4 c 1 5 8 6 10 1 c 2 -5 -3 -11 -9 -9 c -6 2 -6 10 0 12" /></g>`;
function triggerQuery(lineUpToCursor) {
  var _a2, _b, _c, _d;
  const m = /\/([A-Za-z]*)$/.exec(lineUpToCursor);
  if (!m)
    return null;
  const slashAt = lineUpToCursor.length - m[0].length;
  const before = lineUpToCursor.slice(0, slashAt);
  if (!before.trim())
    return null;
  const prev = (_a2 = before.at(-1)) != null ? _a2 : "";
  if (prev === "/" || prev === ":" || prev === ".")
    return null;
  const word = (_c = (_b = /\S*$/.exec(lineUpToCursor)) == null ? void 0 : _b[0]) != null ? _c : "";
  if (((_d = word.match(/\//g)) != null ? _d : []).length > 1)
    return null;
  if (/\d\s*$/.test(before))
    return null;
  if (/https?:$|\]\($/.test(before.trimEnd()))
    return null;
  return m[1];
}
function inVerbatimRegion(editor, line) {
  let fenced = false;
  for (let i = 0; i < line; i++) {
    const text = editor.getLine(i);
    if (/^\s*(```|~~~)/.test(text))
      fenced = !fenced;
    if (i === 0 && text.trim() === "---")
      fenced = true;
    else if (fenced && i > 0 && text.trim() === "---" && editor.getLine(0).trim() === "---") {
      fenced = false;
    }
  }
  return fenced;
}
function applyAction(line, action, today = startOfToday()) {
  var _a2, _b;
  let body = line.replace(/\s+$/, "");
  if (!TASK_PREFIX_RE.test(body)) {
    const bullet = BULLET_PREFIX_RE.exec(body);
    if (bullet) {
      body = `${bullet[1]}[ ] ${body.slice(bullet[1].length)}`;
    } else {
      const indent = (_b = (_a2 = INDENT_RE.exec(body)) == null ? void 0 : _a2[1]) != null ? _b : "";
      body = `${indent}- [ ] ${body.slice(indent.length)}`;
    }
  }
  if (action === "important")
    return setInlineField(body, "important", "true");
  if (action === "urgent") {
    return setInlineField(body, "due", formatDate(addDays(today, URGENT_WINDOW_DAYS)));
  }
  return body;
}
var TaskSuggest = class extends import_obsidian3.EditorSuggest {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onTrigger(cursor, editor, file) {
    const mode = this.plugin.settings.inlineSuggest;
    if (mode === "off")
      return null;
    if (mode === "tracked" && !(file && this.plugin.isInManagedScope(file.path)))
      return null;
    const upToCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
    const query = triggerQuery(upToCursor);
    if (query === null)
      return null;
    if (inVerbatimRegion(editor, cursor.line))
      return null;
    return {
      start: { line: cursor.line, ch: cursor.ch - query.length - 1 },
      end: cursor,
      query
    };
  }
  getSuggestions(context) {
    const q = context.query.toLowerCase();
    return ACTIONS.filter(
      (a) => !q || a.keywords.some((k) => k.startsWith(q)) || a.id.startsWith(q)
    );
  }
  renderSuggestion(item, el) {
    el.addClass("smart-todo-suggest");
    const icon = el.createSpan({ cls: `smart-todo-suggest-icon is-${item.id}` });
    (0, import_obsidian3.setIcon)(icon, SPIRAL_ICON_ID);
    el.createDiv({ cls: "smart-todo-suggest-title", text: item.label });
  }
  selectSuggestion(item) {
    const ctx = this.context;
    if (!ctx)
      return;
    const { editor, start, end, file } = ctx;
    const line = editor.getLine(start.line);
    const stripped = line.slice(0, start.ch) + line.slice(end.ch);
    const next = applyAction(stripped, item.id);
    editor.replaceRange(
      next,
      { line: start.line, ch: 0 },
      { line: start.line, ch: line.length }
    );
    editor.setCursor({ line: start.line, ch: next.length });
    this.close();
    void this.trackOnCapture(file);
  }
  /**
   * Capturing into a note tracks that note.
   *
   * 0.12 only *warned* that an untracked note wouldn't show, with a link to fix
   * it. That was wrong in practice: the task is written, the toast goes away,
   * and what's left is a real markdown checkbox the panel silently refuses to
   * list — which reads as the plugin being broken, and sends you to the search
   * box to type the task a second time.
   *
   * Deliberately choosing "task" in this plugin's own menu *is* the request to
   * manage it, so scope follows the capture. Announced and undoable, because it
   * changes a setting the user didn't open.
   */
  async trackOnCapture(file) {
    if (!file || this.plugin.isInManagedScope(file.path))
      return;
    await this.plugin.toggleTracked(file.path, { silent: true });
    const frag = document.createDocumentFragment();
    frag.createDiv({ text: `Now tracking ${file.basename}.` });
    const link = frag.createEl("a", { text: "Undo", href: "#" });
    link.addEventListener("click", (evt) => {
      evt.preventDefault();
      void this.plugin.toggleTracked(file.path);
    });
    new import_obsidian3.Notice(frag, 6e3);
  }
};

// src/heading-scope-modal.ts
function headingsWithCounts(content) {
  const out = [];
  let current = null;
  let preamble = 0;
  let inFence = false;
  let archived = false;
  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    const h = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const text = h[2].replace(/<[^>]+>/g, "").replace(/[*_`]/g, "").trim();
      if (ARCHIVE_HEADING_RE.test(text)) {
        current = null;
        archived = true;
        continue;
      }
      archived = false;
      current = { heading: text || null, open: 0 };
      if (current.heading)
        out.push(current);
      continue;
    }
    if (archived)
      continue;
    if (!/^\s*(?:[-*+]|\d+[.)])\s+\[ \]/.test(line))
      continue;
    if (current == null ? void 0 : current.heading)
      current.open += 1;
    else
      preamble += 1;
  }
  const whole = {
    heading: null,
    open: preamble + out.reduce((n, c) => n + c.open, 0)
  };
  return [whole, ...out];
}
var HeadingScopeModal = class extends import_obsidian4.FuzzySuggestModal {
  constructor(app, fileName, choices, onPick) {
    super(app);
    this.fileName = fileName;
    this.choices = choices;
    this.onPick = onPick;
    this.setPlaceholder(`Track which part of ${fileName}?`);
    this.setInstructions([
      { command: "\u2191\u2193", purpose: "navigate" },
      { command: "\u21B5", purpose: "track this section" },
      { command: "esc", purpose: "cancel" }
    ]);
    this.modalEl.addClass("smart-todo-heading-scope");
  }
  getItems() {
    return this.choices;
  }
  getItemText(item) {
    var _a2;
    const label = (_a2 = item.heading) != null ? _a2 : "The whole note";
    return `${label} \u2014 ${item.open} open`;
  }
  onChooseItem(item) {
    void this.onPick(item.heading);
  }
  static open(app, fileName, content, onPick) {
    const choices = headingsWithCounts(content);
    if (choices.length <= 1) {
      new import_obsidian4.Notice(`Smart ToDo: ${fileName} has no headings to scope to.`, 4e3);
      void onPick(null);
      return;
    }
    const modal = new HeadingScopeModal(app, fileName, choices, onPick);
    modal.open();
  }
};

// src/settings.ts
var import_obsidian5 = require("obsidian");
var WEEK_PATTERN = "2. Day Planners/Weeks/Week {{week}} of {{year}}.md";
var SmartTodoSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    var _a2;
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
      const scope = this.plugin.scope;
      const matches = this.app.vault.getMarkdownFiles().filter((f) => this.plugin.isInManagedScope(f.path));
      if (scope.usedFallback) {
        summary.createDiv({
          cls: "setting-item-description",
          text: `No scope set \u2014 falling back to ${DEFAULT_MANAGED_FILE}.`
        });
      }
      for (const entry of scope.entries) {
        let text;
        if (entry.kind === "folder") {
          text = `\u{1F4C1} ${entry.path}/ \u2014 all .md files beneath it`;
        } else if (entry.heading) {
          text = `\u{1F4C4} ${entry.path} \u2014 only under \u201C${entry.heading}\u201D`;
        } else {
          text = `\u{1F4C4} ${entry.path}`;
        }
        summary.createDiv({ cls: "setting-item-description", text });
      }
      summary.createDiv({
        cls: "setting-item-description",
        text: `Currently matching ${matches.length} file${matches.length === 1 ? "" : "s"} in the vault. New tasks go to ${primaryManagedFile(scope)}.`
      });
    };
    new import_obsidian5.Setting(el).setName("Managed files").setClass("smart-todo-wide-setting").setDesc(
      `One path per line \u2014 commas are part of a filename, not separators. An entry ending in .md is a single file; anything else is treated as a folder and all .md files under it are included. Example: "${DEFAULT_MANAGED_FILE}" then "Projects/Tasks". Add #Heading to a .md path to track only that section \u2014 "Meetings/board.md#Important" ignores the rest of the note. To add a project note, right-click it and choose "Smart ToDo: track tasks in this note" instead of typing it here.`
    ).addTextArea((text) => {
      text.setPlaceholder(DEFAULT_MANAGED_FILE).setValue(this.plugin.settings.managedFiles).onChange(async (value) => {
        this.plugin.settings.managedFiles = value;
        await this.plugin.saveSettings();
        renderSummary();
        this.plugin.refreshViews();
      });
      text.inputEl.rows = 8;
      text.inputEl.addClass("smart-todo-scope-input");
    });
    el.appendChild(summary);
    renderSummary();
    new import_obsidian5.Setting(el).setName("Create the managed file").setDesc(
      "Creates the file new tasks are appended to, if it doesn't exist yet."
    ).addButton(
      (btn) => btn.setButtonText("Create now").onClick(async () => {
        await this.plugin.ensurePrimaryFile();
        renderSummary();
      })
    );
    new import_obsidian5.Setting(el).setName("Inbox file").setClass("smart-todo-wide-setting").setDesc(
      `Optional. Open tasks in this file are treated as untriaged captures: they show in an Inbox bucket at the top of the panel and nowhere else. Keep moves one into ${primaryManagedFile(this.plugin.scope)}. Leave blank to turn the Inbox off.`
    ).addText((text) => {
      text.setPlaceholder("Task inbox.md").setValue(this.plugin.settings.inboxFile).onChange(async (value) => {
        this.plugin.settings.inboxFile = value;
        await this.plugin.saveSettings();
        renderInboxWarning();
        this.plugin.refreshViews();
      });
      text.inputEl.addClass("smart-todo-scope-input");
    });
    const inboxWarning = el.createDiv();
    const renderInboxWarning = () => {
      inboxWarning.empty();
      if (!this.plugin.inboxOutOfScope)
        return;
      const path = this.plugin.inboxPath;
      inboxWarning.createDiv({
        cls: "setting-item-description",
        text: `\u26A0 ${path} isn't in the managed scope above, so it's never scanned \u2014 the Inbox will stay empty.`
      });
      new import_obsidian5.Setting(inboxWarning).setName("Add the inbox to managed files").addButton(
        (btn) => btn.setButtonText("Add to scope").onClick(async () => {
          this.plugin.settings.managedFiles = addPathToScope(
            this.plugin.settings.managedFiles,
            path
          );
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
          this.display();
        })
      );
    };
    renderInboxWarning();
    el.createEl("h3", { text: "The weekly page" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "A tracked path can carry {{week}}, {{week:02}} and {{year}}, which resolve each time the panel scans. Track the pattern once and the right week's page is always the one being read."
    });
    new import_obsidian5.Setting(el).setName("Resolve {{week}} and {{year}} in tracked paths").setDesc(
      "Off means a path with braces in it is skipped rather than treated as a literal filename."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.weekTokensEnabled !== false).onChange(async (v) => {
        this.plugin.settings.weekTokensEnabled = v;
        await this.plugin.saveSettings();
        renderSummary();
        this.plugin.refreshViews();
      })
    );
    new import_obsidian5.Setting(el).setName("Weeks start on").setDesc(
      `Which convention your week-page numbering follows. Sunday is the US convention (week 1 contains Jan 1); Monday is ISO-8601. These disagree by one for much of the year, and the wrong one points at an adjacent week's file \u2014 which looks like the feature not working. Right now: week ${weekNumber(new Date(), (_a2 = this.plugin.settings.weekStart) != null ? _a2 : "sunday")}.`
    ).addDropdown((dd) => {
      var _a3;
      dd.addOption("sunday", "Sunday (US)");
      dd.addOption("monday", "Monday (ISO-8601)");
      dd.setValue((_a3 = this.plugin.settings.weekStart) != null ? _a3 : "sunday").onChange(async (v) => {
        this.plugin.settings.weekStart = v;
        await this.plugin.saveSettings();
        renderSummary();
        this.plugin.refreshViews();
        this.display();
      });
    });
    new import_obsidian5.Setting(el).setName("Track this week's page").setDesc(
      `Adds "${WEEK_PATTERN}" to the managed files above. Edit the pattern there if your weekly notes live somewhere else.`
    ).addButton(
      (btn) => btn.setButtonText(
        scopeIncludesPath(this.plugin.settings.managedFiles, WEEK_PATTERN) ? "Already tracked" : "Track it"
      ).onClick(async () => {
        var _a3;
        this.plugin.settings.managedFiles = addPathToScope(
          this.plugin.settings.managedFiles,
          WEEK_PATTERN
        );
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
        const resolved = expandPathTokens(
          WEEK_PATTERN,
          new Date(),
          (_a3 = this.plugin.settings.weekStart) != null ? _a3 : "sunday"
        );
        const exists = !!this.app.vault.getAbstractFileByPath(resolved);
        new import_obsidian5.Notice(
          exists ? `Smart ToDo: tracking ${resolved}.` : `Smart ToDo: pattern added, but ${resolved} doesn't exist yet \u2014 check the folder and the week-start setting.`,
          8e3
        );
        this.display();
      })
    );
    new import_obsidian5.Setting(el).setName("Headings that mean important").setClass("smart-todo-wide-setting").setDesc(
      'Comma-separated. A task under a heading containing any of these counts as important unless the task says otherwise itself \u2014 the judgment on "Focus this week, what is Important and Urgent" was made once for the whole list rather than once per line. The panel marks inferred importance with \xA7 so you can see where it came from.'
    ).addTextArea((text) => {
      var _a3;
      text.setPlaceholder(DEFAULT_IMPORTANT_HEADINGS.join(", ")).setValue(((_a3 = this.plugin.settings.importantHeadings) != null ? _a3 : []).join(", ")).onChange(async (value) => {
        this.plugin.settings.importantHeadings = value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      });
      text.inputEl.rows = 2;
      text.inputEl.addClass("smart-todo-scope-input");
    });
    new import_obsidian5.Setting(el).setName("Split tracked notes by heading").setDesc(
      "Inside a tracked note, group its tasks under the heading each sits below. On a weekly page those sections are most of the meaning."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.groupByHeading !== false).onChange(async (v) => {
        this.plugin.settings.groupByHeading = v;
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      })
    );
    el.createEl("h3", { text: "Display" });
    new import_obsidian5.Setting(el).setName("Metadata as chips in the editor").setDesc(
      "Show [due:: \u2026], [effort:: \u2026] and the legacy emoji as small chips while editing a note. Put the cursor on a line to see the raw text \u2014 nothing is hidden from editing, and the file on disk is unchanged."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.metadataChips !== false).onChange(async (v) => {
        this.plugin.settings.metadataChips = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(el).setName("Inline / menu").setDesc(
      'Type a line, then "/" at the end of it, to turn it into a task \u2014 plain, important, or due in two days (which is what makes it urgent). It fires on a bare keystroke, so restrict or disable it here.'
    ).addDropdown(
      (d) => {
        var _a3;
        return d.addOptions({
          everywhere: "Every note",
          tracked: "Tracked notes only",
          off: "Off"
        }).setValue((_a3 = this.plugin.settings.inlineSuggest) != null ? _a3 : "everywhere").onChange(async (v) => {
          this.plugin.settings.inlineSuggest = v;
          await this.plugin.saveSettings();
        });
      }
    );
    const accentSetting = new import_obsidian5.Setting(el).setName("Accent").setDesc("Tints the panel: titles, the mark, the active chips, the sweep ring.");
    const accentRow = accentSetting.controlEl.createDiv({ cls: "smart-todo-accent-row" });
    const paintAccents = () => {
      accentRow.empty();
      for (const id of Object.keys(ACCENTS)) {
        const def = ACCENTS[id];
        const btn = accentRow.createEl("button", { cls: "smart-todo-accent" });
        btn.style.setProperty("--swatch", def.base);
        btn.createSpan({ cls: "smart-todo-accent-swatch" });
        btn.createSpan({ text: def.label });
        if (this.plugin.settings.accent === id)
          btn.addClass("is-active");
        btn.addEventListener("click", async () => {
          this.plugin.settings.accent = id;
          await this.plugin.saveSettings();
          paintAccents();
          this.plugin.rebuildViews();
        });
      }
    };
    paintAccents();
    new import_obsidian5.Setting(el).setName("Opens in").setDesc(
      "Which mode the panel starts in. Focus groups by Eisenhower quadrant, Sweep runs the timer, Lanes shows the effort board."
    ).addDropdown((dd) => {
      for (const m of MODES)
        dd.addOption(m.id, m.label);
      dd.setValue(this.plugin.settings.defaultMode).onChange(async (value) => {
        this.plugin.settings.defaultMode = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian5.Setting(el).setName("Pushes warning threshold").setDesc(
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
    el.createEl("h3", { text: "Sweep" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "A sweep is a timed run through the three-minute tasks: one at a time, with Done / Skip / Takes longer on the keyboard."
    });
    new import_obsidian5.Setting(el).setName("Offer a sweep in the list").setDesc(
      `Shows a "you have N quick wins" banner inside the task list when there are at least two. Turn this off if you'd rather only reach Sweep from the mode row.`
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showSweepBanner).onChange(async (value) => {
        this.plugin.settings.showSweepBanner = value;
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      })
    );
    new import_obsidian5.Setting(el).setName("Seconds per task").setDesc(
      "The countdown for each task in a sweep. Three minutes is the point of the light-effort tag, so that's the default; going over doesn't stop you, it just turns the clock red."
    ).addText(
      (text) => text.setValue(String(this.plugin.settings.sweepSeconds)).onChange(async (value) => {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 15) {
          this.plugin.settings.sweepSeconds = Math.floor(n);
          await this.plugin.saveSettings();
        }
      })
    );
    el.createEl("h3", { text: "Categories" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Tasks carry one of three categories \u2014 Betaworks, Personal, Health \u2014 stored in the same [project:: \u2026] field, so Dataview and Tasks queries keep working. Imported tasks with older project names can be folded onto the three in one pass; you'll see every change first."
    });
    new import_obsidian5.Setting(el).setName("Fold projects into categories").setDesc(
      "Previews the retag, then applies it one line at a time. Tasks with no project are left alone."
    ).addButton(
      (btn) => btn.setButtonText("Review changes").onClick(() => void this.plugin.openCategoryMigration())
    );
  }
};

// src/add-task-modal.ts
var import_obsidian6 = require("obsidian");
var AddTaskModal = class extends import_obsidian6.Modal {
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
    new import_obsidian6.Setting(contentEl).setName("Task").addText((text) => {
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
    new import_obsidian6.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Add").setCta().onClick(commit)
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

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
        var _a2;
        const qualifier = (m[1] || "").toLowerCase();
        const word = m[2].toLowerCase();
        let idx = WEEKDAYS.indexOf(word);
        if (idx === -1)
          idx = (_a2 = WEEKDAY_ALIASES[word]) != null ? _a2 : -1;
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
var EFFORT_RE = /\b(deep work|deep|heavy|hard|big|moderate|medium|light|easy|quick|small)\b/i;
var EFFORT_MAP = {
  "deep work": "deep",
  deep: "deep",
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
  var _a2;
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
    effort = (_a2 = EFFORT_MAP[eff[1].toLowerCase()]) != null ? _a2 : null;
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
  var _a2, _b, _c, _d;
  const built = parseNaturalTask(input);
  const nld = (_b = (_a2 = app.plugins) == null ? void 0 : _a2.plugins) == null ? void 0 : _b["nldates-obsidian"];
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
    body += ` [due:: ${formatDate(due)}]`;
  if (defer)
    body += ` [defer:: ${formatDate(defer)}]`;
  if (effort)
    body += ` [effort:: ${effort}]`;
  if (project)
    body += ` [project:: ${project}]`;
  if (assigned)
    body += ` [assigned:: ${assigned}]`;
  return body.trim() || input.trim();
}

// src/view.ts
var import_obsidian10 = require("obsidian");

// src/edit-task-modal.ts
var import_obsidian7 = require("obsidian");
function dateInputValue(date) {
  return date ? formatDate(date) : "";
}
var EditTaskModal = class extends import_obsidian7.Modal {
  constructor(app, task, onSubmit, onReveal, keepTarget = null) {
    super(app);
    this.task = task;
    this.onSubmit = onSubmit;
    this.onReveal = onReveal;
    this.keepTarget = keepTarget;
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
    const deferWrap = this.field(contentEl, "Defer until");
    const deferInput = deferWrap.createEl("input", {
      cls: "smart-todo-edit-date",
      attr: { type: "date" }
    });
    deferInput.value = dateInputValue(this.draft.defer);
    deferInput.addEventListener("change", () => {
      this.draft.defer = deferInput.value ? parseDate(deferInput.value) : null;
    });
    this.quickOffsets(deferWrap, (shift) => {
      const base = this.draft.defer;
      const today = startOfToday();
      const from = base && base.getTime() > today.getTime() ? base : today;
      const next = shift === null ? null : shift(from);
      this.draft.defer = next;
      deferInput.value = dateInputValue(next);
    });
    this.hint(
      deferWrap,
      "Hidden from Today and This Week until this date. Past a week out it also leaves All, and shows under Deferred."
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
    (0, import_obsidian7.setIcon)(reveal.createSpan({ cls: "smart-todo-edit-reveal-icon" }), "file-text");
    reveal.addEventListener("click", () => {
      this.close();
      this.onReveal();
    });
    const spacer = actions.createDiv({ cls: "smart-todo-modal-spacer" });
    spacer.setText("");
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", {
      cls: "mod-cta",
      text: this.keepTarget ? "Save & keep" : "Save"
    });
    if (this.keepTarget)
      save.setAttr("aria-label", `Save and move into ${this.keepTarget}`);
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
      { label: "Tomorrow", date: addDays(today, 1) },
      { label: "+1 week", date: addDays(today, 7) },
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
  /**
   * +1d / +2d / +1w / +1m / Clear — the defer shortcuts.
   *
   * Each hands back a function rather than a date so the caller decides what
   * they count from; null is Clear.
   */
  quickOffsets(parent, set) {
    const row = parent.createDiv({ cls: "smart-todo-quickdates" });
    const opts = [
      { label: "+1d", shift: (from) => addDays(from, 1) },
      { label: "+2d", shift: (from) => addDays(from, 2) },
      { label: "+1w", shift: (from) => addDays(from, 7) },
      { label: "+1m", shift: (from) => addMonths(from, 1) },
      { label: "Clear", shift: null }
    ];
    for (const opt of opts) {
      const btn = row.createEl("button", {
        cls: "smart-todo-quickdate",
        text: opt.label
      });
      btn.addEventListener("click", () => set(opt.shift));
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
    var _a2, _b, _c;
    const patch = {};
    const d = this.draft;
    const t = this.task;
    if (!d.title.trim()) {
      new import_obsidian7.Notice("Smart ToDo: a task needs a title.", 4e3);
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
    const currentCanonical = (_b = (_a2 = t.project) == null ? void 0 : _a2.trim().toLowerCase()) != null ? _b : null;
    if (((_c = d.category) != null ? _c : null) !== currentCanonical)
      patch.project = d.category;
    this.close();
    await this.onSubmit(patch);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/sweep-modal.ts
var import_obsidian8 = require("obsidian");
var NEXT_EFFORT = {
  light: "moderate",
  moderate: "heavy",
  heavy: "deep",
  deep: null
};
var SweepModal = class extends import_obsidian8.Modal {
  constructor(app, queue, seconds, onFinish) {
    super(app);
    this.index = 0;
    this.outcomes = /* @__PURE__ */ new Map();
    this.ticker = null;
    this.queue = queue;
    this.seconds = seconds;
    this.remaining = seconds;
    this.onFinish = onFinish;
  }
  onOpen() {
    this.modalEl.addClass("smart-todo-sweep-modal");
    const { contentEl } = this;
    contentEl.empty();
    this.bodyEl = contentEl.createDiv({ cls: "stw-sweep" });
    this.scope.register([], " ", (evt) => {
      evt.preventDefault();
      void this.resolve("done");
    });
    this.scope.register([], "s", () => void this.resolve("skipped"));
    this.scope.register([], "l", () => void this.resolve("promoted"));
    this.start();
    this.paint();
  }
  onClose() {
    this.stop();
    this.contentEl.empty();
    this.onFinish();
  }
  start() {
    this.stop();
    this.remaining = this.seconds;
    this.ticker = setInterval(() => {
      this.remaining = Math.max(0, this.remaining - 1);
      this.paintClock();
    }, 1e3);
  }
  stop() {
    if (this.ticker)
      clearInterval(this.ticker);
    this.ticker = null;
  }
  get current() {
    var _a2;
    return (_a2 = this.queue[this.index]) != null ? _a2 : null;
  }
  /**
   * Record an outcome, write it if it has a side effect, and advance.
   *
   * "Takes longer" is the one that earns its keystroke: it moves the task up an
   * effort level, which means next time you ask for three minutes of work this
   * task correctly isn't offered. A skip changes nothing on disk — skipping is
   * allowed to be free, or you stop using it and start lying to the timer.
   */
  async resolve(outcome) {
    const task = this.current;
    if (!task)
      return;
    const key = `${task.filePath}:${task.lineNumber}`;
    if (outcome === "done") {
      await safeWrite(() => toggleTaskDone(this.app, task, true));
    } else if (outcome === "promoted") {
      const next = task.effort ? NEXT_EFFORT[task.effort] : "moderate";
      if (next)
        await safeWrite(() => setTaskEffort(this.app, task, next));
    }
    this.outcomes.set(key, outcome);
    this.index++;
    this.start();
    this.paint();
  }
  paint() {
    this.bodyEl.empty();
    const task = this.current;
    if (!task) {
      this.stop();
      this.paintSummary();
      return;
    }
    const head = this.bodyEl.createDiv({ cls: "stw-sweep-head" });
    const badge = head.createSpan({ cls: "stw-sweep-badge" });
    (0, import_obsidian8.setIcon)(badge.createSpan({ cls: "stw-sweep-badge-icon" }), "zap");
    badge.createSpan({
      text: `Quick win ${this.index + 1} of ${this.queue.length}`
    });
    this.bodyEl.createDiv({ cls: "stw-sweep-title", text: displayTitle(task.title) || "(untitled task)" });
    const chips = this.bodyEl.createDiv({ cls: "stw-sweep-chips" });
    const cat = categoryFor(task.project);
    if (cat) {
      const chip = chips.createSpan({ cls: "stw-chip" });
      chip.createSpan({
        cls: "stw-dot",
        attr: { style: `background:${CATEGORY_COLOR[cat]}` }
      });
      chip.createSpan({ text: CATEGORY_LABEL[cat] });
    }
    if (task.effort) {
      chips.createSpan({
        cls: "stw-chip",
        text: `${EFFORT_MINUTES[task.effort]} min`
      });
    }
    this.paintClock();
    const actions = this.bodyEl.createDiv({ cls: "stw-sweep-actions" });
    this.actionBtn(actions, "Done", "Space", "is-primary", () => void this.resolve("done"));
    this.actionBtn(actions, "Skip", "S", "", () => void this.resolve("skipped"));
    this.actionBtn(actions, "Takes longer", "L", "", () => void this.resolve("promoted"));
    const next = task.effort ? NEXT_EFFORT[task.effort] : "moderate";
    this.bodyEl.createDiv({
      cls: "stw-sweep-hint",
      text: next ? `"Takes longer" moves it to the ${next === "deep" ? "deep work" : next === "heavy" ? "1 hour" : "15 minute"} lane and starts the next one.` : `"Takes longer" just moves on \u2014 this is already deep work.`
    });
  }
  /**
   * Only the clock redraws on each tick. Repainting the whole modal once a
   * second would steal focus from the buttons and make the title flicker.
   */
  paintClock() {
    let ring = this.bodyEl.querySelector(".stw-sweep-clock");
    if (!ring) {
      if (!this.current)
        return;
      ring = this.bodyEl.createDiv({ cls: "stw-sweep-clock" });
      const actions = this.bodyEl.querySelector(".stw-sweep-actions");
      if (actions)
        this.bodyEl.insertBefore(ring, actions);
    }
    const pct = this.seconds > 0 ? this.remaining / this.seconds : 0;
    ring.style.setProperty("--sweep-pct", String(Math.max(0, Math.min(1, pct))));
    ring.toggleClass("is-over", this.remaining === 0);
    ring.empty();
    const mm = Math.floor(this.remaining / 60);
    const ss = String(this.remaining % 60).padStart(2, "0");
    ring.createDiv({ cls: "stw-sweep-time", text: `${mm}:${ss}` });
    ring.createDiv({
      cls: "stw-sweep-of",
      text: this.remaining === 0 ? "over" : `of ${Math.floor(this.seconds / 60)}:00`
    });
  }
  actionBtn(parent, label, key, cls, onClick) {
    const btn = parent.createEl("button", { cls: `stw-sweep-btn ${cls}`.trim() });
    btn.createSpan({ text: label });
    btn.createSpan({ cls: "stw-sweep-key", text: key });
    btn.addEventListener("click", onClick);
  }
  paintSummary() {
    const values = [...this.outcomes.values()];
    const done = values.filter((v) => v === "done").length;
    const promoted = values.filter((v) => v === "promoted").length;
    const skipped = values.filter((v) => v === "skipped").length;
    const cleared = this.queue.filter((t) => this.outcomes.get(`${t.filePath}:${t.lineNumber}`) === "done").reduce((sum, t) => sum + (t.effort ? EFFORT_MINUTES[t.effort] : 0), 0);
    this.bodyEl.createDiv({ cls: "stw-sweep-title", text: "Sweep complete" });
    const stats = this.bodyEl.createDiv({ cls: "stw-sweep-stats" });
    const stat = (n, label) => {
      const cell = stats.createDiv({ cls: "stw-sweep-stat" });
      cell.createDiv({ cls: "stw-sweep-stat-n", text: String(n) });
      cell.createDiv({ cls: "stw-sweep-stat-l", text: label });
    };
    stat(done, done === 1 ? "done" : "done");
    stat(promoted, "resized");
    stat(skipped, "skipped");
    this.bodyEl.createDiv({
      cls: "stw-sweep-hint",
      text: done > 0 ? `About ${formatDuration(cleared)} of small stuff off the list.` : "Nothing cleared \u2014 the list is unchanged."
    });
    const actions = this.bodyEl.createDiv({ cls: "stw-sweep-actions" });
    this.actionBtn(actions, "Close", "Esc", "is-primary", () => this.close());
  }
};

// src/quick-switch.ts
var import_obsidian9 = require("obsidian");
var QuickSwitchModal = class extends import_obsidian9.SuggestModal {
  constructor(app, tasks, onPick) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder("work, quick, do first, or a task\u2026");
    this.rows = buildRows(tasks);
    this.limit = 40;
  }
  getSuggestions(query) {
    const q = query.trim().toLowerCase();
    if (!q)
      return this.rows.filter((r) => r.action.kind !== "task").slice(0, 12);
    const hits = this.rows.filter(
      (r) => r.title.toLowerCase().includes(q) || r.note.toLowerCase().includes(q) || r.keywords.includes(q)
    );
    hits.push({
      action: { kind: "search", text: query.trim() },
      title: `Filter the list by "${query.trim()}"`,
      note: "Search",
      keywords: ""
    });
    return hits;
  }
  renderSuggestion(row, el) {
    el.addClass("stw-qs-row");
    el.createDiv({ cls: "stw-qs-title", text: row.title });
    if (row.note)
      el.createDiv({ cls: "stw-qs-note", text: row.note });
  }
  onChooseSuggestion(row) {
    this.onPick(row.action);
  }
};
function buildRows(tasks) {
  var _a2, _b;
  const rows = [];
  for (const m of MODES) {
    rows.push({
      action: { kind: "mode", mode: m.id },
      title: m.label,
      note: "Mode",
      keywords: `mode view ${m.label.toLowerCase()}`
    });
  }
  for (const b of BUDGETS) {
    rows.push({
      action: { kind: "budget", budget: b.id },
      title: b.label,
      note: "I have\u2026",
      keywords: b.id === "3m" ? "quick quickie quick win small short minutes" : b.id === "any" ? "all everything any" : "time budget minutes hour"
    });
  }
  rows.push({
    action: { kind: "category", category: "all" },
    title: "All categories",
    note: "Category",
    keywords: "all everything"
  });
  for (const c of CATEGORIES) {
    rows.push({
      action: { kind: "category", category: c },
      title: CATEGORY_LABEL[c],
      note: "Category",
      keywords: c === "betaworks" ? "work job fund" : c === "personal" ? "life home" : "body"
    });
  }
  for (const h of HORIZONS) {
    rows.push({
      action: { kind: "horizon", horizon: h.id },
      title: h.label,
      note: "When",
      keywords: `when horizon ${h.label.toLowerCase()}`
    });
  }
  for (const t of tasks) {
    rows.push({
      action: { kind: "task", task: t },
      title: t.title || "(untitled task)",
      note: (_a2 = t.filePath.split("/").pop()) != null ? _a2 : t.filePath,
      keywords: ((_b = t.project) != null ? _b : "").toLowerCase()
    });
  }
  return rows;
}

// src/view.ts
var SmartTodoView = class extends import_obsidian10.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.mode = "focus";
    this.horizon = "today";
    this.budget = "any";
    this.category = "all";
    this.search = "";
    /** Set by "Search all tasks" in the empty state; cleared with the search box. */
    this.searchEverywhere = false;
    this.tasks = [];
    this.loading = false;
    /** Inbox bucket expanded? Collapsed is a legitimate "not now", not a hide. */
    this.inboxOpen = true;
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_SMART_TODO;
  }
  getDisplayText() {
    return "Smart ToDo";
  }
  getIcon() {
    return SPIRAL_ICON_ID;
  }
  async onOpen() {
    this.mode = this.plugin.settings.defaultMode;
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("smart-todo-root");
    this.applyAccent(root);
    this.renderTitleBar(root);
    this.renderSearch(root);
    this.filtersEl = root.createDiv({ cls: "stw-filters" });
    this.bodyEl = root.createDiv({ cls: "stw-body" });
    this.renderFilters();
    await this.refresh();
  }
  async onClose() {
    var _a2;
    (_a2 = this.containerEl.children[1]) == null ? void 0 : _a2.empty();
  }
  /**
   * Accent lives in CSS custom properties so one setting repaints everything.
   * Set here *and* on document.body by the plugin — the panel keeps working if
   * something resets body, and modals (mounted outside this tree) inherit.
   */
  applyAccent(root) {
    applyAccentVars(root, this.plugin.settings.accent);
  }
  /** Repaint from scratch — used when a setting changes shape, not just data. */
  rebuild() {
    void this.onOpen();
  }
  async refresh() {
    this.loading = true;
    this.render();
    this.tasks = await this.plugin.scan();
    this.loading = false;
    this.renderFilters();
    this.render();
  }
  // --- Header --------------------------------------------------------------
  renderTitleBar(root) {
    const bar = root.createDiv({ cls: "stw-titlebar" });
    const brand = bar.createDiv({ cls: "stw-brand" });
    const mark = brand.createSpan({ cls: "stw-mark" });
    (0, import_obsidian10.setIcon)(mark, "check");
    brand.createSpan({ cls: "stw-brand-name", text: "Smart ToDo" });
    bar.createSpan({
      cls: "stw-date",
      text: new Date().toLocaleDateString(void 0, {
        weekday: "short",
        month: "short",
        day: "numeric"
      })
    });
    const refresh = bar.createEl("button", {
      cls: "stw-icon-btn",
      attr: { "aria-label": "Rescan vault" }
    });
    (0, import_obsidian10.setIcon)(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.refresh());
    const add = bar.createEl("button", {
      cls: "stw-icon-btn is-primary",
      attr: { "aria-label": "Add task" }
    });
    (0, import_obsidian10.setIcon)(add, "plus");
    add.addEventListener("click", () => this.focusCapture());
  }
  /**
   * Search box. Typing filters the list live; ⌘K (or clicking the hint) opens
   * the palette, which can set any filter *or* jump to a task. Both write the
   * same state, so the chips below always reflect what the box did.
   */
  renderSearch(root) {
    const wrap = root.createDiv({ cls: "stw-search" });
    const icon = wrap.createSpan({ cls: "stw-search-icon" });
    (0, import_obsidian10.setIcon)(icon, "search");
    this.searchInputEl = wrap.createEl("input", {
      cls: "stw-search-input",
      attr: { type: "text", placeholder: "work, quick, do first\u2026" }
    });
    const clear = wrap.createSpan({ cls: "stw-search-clear" });
    (0, import_obsidian10.setIcon)(clear, "x");
    clear.setAttribute("aria-label", "Clear search");
    const syncClear = () => clear.toggleClass("is-visible", this.search.length > 0);
    this.searchInputEl.addEventListener("input", () => {
      this.search = this.searchInputEl.value;
      this.searchEverywhere = false;
      syncClear();
      this.renderFilters();
      this.render();
    });
    const clearSearch = (refocus) => {
      this.searchInputEl.value = "";
      this.search = "";
      this.searchEverywhere = false;
      syncClear();
      if (refocus)
        this.searchInputEl.focus();
      else
        this.searchInputEl.blur();
      this.renderFilters();
      this.render();
    };
    clear.addEventListener("click", (evt) => {
      evt.preventDefault();
      clearSearch(true);
    });
    this.searchInputEl.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") {
        clearSearch(false);
      } else if (evt.key === "Enter") {
        evt.preventDefault();
        void this.captureFromSearch();
      } else if (evt.key === "k" && (evt.metaKey || evt.ctrlKey)) {
        evt.preventDefault();
        this.openPalette();
      }
    });
    const kbd = wrap.createSpan({ cls: "stw-kbd", text: "\u2318K" });
    kbd.addEventListener("click", () => this.openPalette());
    this.searchInputEl.value = this.search;
    syncClear();
  }
  focusCapture() {
    this.searchInputEl.focus();
    this.searchInputEl.select();
  }
  /**
   * Enter in the search box with text that matches nothing → create it.
   *
   * "Matches nothing" has to mean nothing *anywhere*, not nothing under the
   * current filters. Searching "gala" from Today finds no open dated task and
   * used to offer to create one — while three gala lines sat in the note, two
   * ticked and one undated. Pressing Enter there would have written a
   * duplicate of a task that already existed, which is the one thing a to-do
   * list must never do to you. So Enter reveals the match first; it only
   * captures when the vault really has nothing.
   */
  async captureFromSearch() {
    const value = this.searchInputEl.value.trim();
    if (!value)
      return;
    if (this.visibleTasks().length > 0)
      return;
    if (matchesSearch(this.listTasks, value).length > 0) {
      this.showAllMatches();
      return;
    }
    const ok = await this.plugin.addTask(value);
    if (ok) {
      this.searchInputEl.value = "";
      this.search = "";
    }
    await this.refresh();
  }
  /**
   * Public so a command can open the palette without the panel being focused.
   * The command is the honest entry point — ⌘K only works while the panel has
   * focus, and a palette you can only reach from inside the thing it navigates
   * isn't much of a shortcut.
   */
  openPalette() {
    new QuickSwitchModal(this.app, this.tasks, (action) => this.applyAction(action)).open();
  }
  applyAction(action) {
    switch (action.kind) {
      case "mode":
        this.mode = action.mode;
        break;
      case "budget":
        this.budget = action.budget;
        break;
      case "category":
        this.category = action.category;
        break;
      case "horizon":
        this.horizon = action.horizon;
        break;
      case "search":
        this.search = action.text;
        this.searchInputEl.value = action.text;
        break;
      case "task":
        void this.revealTask(action.task);
        return;
    }
    this.renderFilters();
    this.render();
  }
  // --- Filter rows ---------------------------------------------------------
  renderFilters() {
    if (!this.filtersEl)
      return;
    this.filtersEl.empty();
    this.renderModeRow();
    if (this.mode !== "lanes")
      this.renderBudgetRow();
    this.renderCategoryRow();
  }
  renderModeRow() {
    var _a2, _b;
    const row = this.filtersEl.createDiv({ cls: "stw-row stw-moderow" });
    const caps = row.createDiv({ cls: "stw-modes" });
    for (const m of MODES) {
      const btn = caps.createEl("button", { cls: "stw-mode" });
      (0, import_obsidian10.setTooltip)(btn, m.label, { placement: "bottom" });
      const ic = btn.createSpan({ cls: "stw-mode-icon" });
      (0, import_obsidian10.setIcon)(ic, m.icon);
      btn.createSpan({ cls: "stw-mode-count", text: String(this.countForMode(m.id)) });
      if (m.id === this.mode)
        btn.addClass("is-active");
      btn.addEventListener("click", () => {
        this.mode = m.id;
        this.renderFilters();
        this.render();
      });
    }
    row.createDiv({ cls: "stw-row-divider" });
    const when = row.createEl("button", { cls: "stw-when" });
    (0, import_obsidian10.setTooltip)(when, "When", { placement: "bottom" });
    when.createSpan({
      text: (_b = (_a2 = HORIZONS.find((h) => h.id === this.horizon)) == null ? void 0 : _a2.label) != null ? _b : "Today"
    });
    (0, import_obsidian10.setIcon)(when.createSpan({ cls: "stw-when-caret" }), "chevron-down");
    when.addEventListener("click", (evt) => {
      const menu = new import_obsidian10.Menu();
      for (const h of HORIZONS) {
        menu.addItem(
          (item) => item.setTitle(h.label).setChecked(this.horizon === h.id).onClick(() => {
            this.horizon = h.id;
            this.renderFilters();
            void this.refresh();
          })
        );
      }
      menu.showAtMouseEvent(evt);
    });
  }
  /**
   * "I have…" — the budget row. Counts are live, so the row doubles as an
   * answer before you click: *10 things fit in three minutes* is itself the
   * useful fact.
   */
  renderBudgetRow() {
    const wrap = this.filtersEl.createDiv({ cls: "stw-budget-wrap" });
    const row = wrap.createDiv({ cls: "stw-row stw-budgets" });
    for (const b of BUDGETS) {
      const count = this.listTasks.filter(
        (t) => matchesHorizon(t, this.horizon) && matchesCategory(t, this.category) && fitsBudget(t, b.id)
      ).length;
      const btn = row.createEl("button", { cls: "stw-budget" });
      btn.createSpan({ cls: "stw-budget-label", text: b.label });
      btn.createSpan({ cls: "stw-budget-count", text: String(count) });
      if (b.id === this.budget)
        btn.addClass("is-active");
      if (count === 0)
        btn.addClass("is-empty");
      btn.addEventListener("click", () => {
        this.budget = b.id;
        this.renderFilters();
        this.render();
      });
    }
  }
  renderCategoryRow() {
    const row = this.filtersEl.createDiv({ cls: "stw-row stw-cats" });
    const chips = [
      { id: "all", label: "All" },
      ...CATEGORIES.map((c) => ({ id: c, label: CATEGORY_LABEL[c] }))
    ];
    for (const c of chips) {
      const btn = row.createEl("button", { cls: "stw-cat", text: c.label });
      if (c.id === this.category)
        btn.addClass("is-active");
      if (c.id !== "all") {
        btn.style.setProperty("--cat-color", CATEGORY_COLOR[c.id]);
        btn.addClass("has-color");
      }
      btn.addEventListener("click", () => {
        this.category = c.id;
        this.renderFilters();
        this.render();
      });
    }
  }
  // --- Selection -----------------------------------------------------------
  get query() {
    return {
      horizon: this.horizon,
      // Sweep is the budget made literal: whatever the budget says fits, this
      // is the run-through of it. Lanes show every size side by side.
      budget: this.mode === "lanes" ? "any" : this.budget,
      category: this.category,
      search: this.search,
      searchEverywhere: this.searchEverywhere
    };
  }
  /** Drop the filters for the current search term and repaint. */
  showAllMatches() {
    this.searchEverywhere = true;
    this.renderFilters();
    this.render();
  }
  /**
   * The working list: everything the panel's filters apply to.
   *
   * One rule, no exceptions: an *open* task in the inbox file appears in the
   * Inbox bucket and nowhere else. It's held out of the list, out of the mode
   * counts, out of the budget counts and out of a sweep, so a count can never
   * promise something the list below it doesn't show. Keep it and it joins
   * this set; drop it and it leaves as a completed line.
   */
  get listTasks() {
    if (!this.plugin.inboxPath)
      return this.tasks;
    return this.tasks.filter((t) => !this.plugin.isInboxTask(t));
  }
  visibleTasks() {
    return selectTasks(this.listTasks, this.query);
  }
  /**
   * The triage queue, oldest capture first.
   *
   * Deliberately not run through `selectTasks`: a capture usually has no date
   * and no effort, so every filter in the panel would hide it — which is
   * exactly how a voice note silently goes nowhere. Search is the one filter
   * that applies, because searching for something you just said and not
   * finding it would be worse.
   */
  inboxTasks() {
    if (!this.plugin.inboxPath)
      return [];
    const needle = this.search.trim().toLowerCase();
    return this.tasks.filter((t) => this.plugin.isInboxTask(t)).filter((t) => !needle || t.title.toLowerCase().includes(needle)).sort((a, b) => a.lineNumber - b.lineNumber);
  }
  /** The number on each mode button — what that mode would show right now. */
  countForMode(mode) {
    const base = this.listTasks.filter(
      (t) => matchesHorizon(t, this.horizon) && matchesCategory(t, this.category)
    );
    if (mode === "lanes") {
      return new Set(base.filter((t) => t.effort).map((t) => t.effort)).size;
    }
    if (mode === "sweep")
      return base.filter((t) => fitsBudget(t, "3m")).length;
    return base.filter((t) => fitsBudget(t, this.budget)).length;
  }
  // --- Body ----------------------------------------------------------------
  render() {
    if (!this.bodyEl)
      return;
    const today = startOfToday();
    this.bodyEl.empty();
    if (this.loading && this.tasks.length === 0) {
      this.bodyEl.createDiv({ cls: "stw-empty", text: "Scanning\u2026" });
      return;
    }
    const inbox = this.inboxTasks();
    const showInbox = inbox.length > 0 && this.mode !== "sweep" && this.horizon !== "done";
    if (showInbox)
      this.renderInbox(inbox, today);
    const tasks = this.visibleTasks();
    if (tasks.length === 0) {
      if (showInbox) {
        this.bodyEl.createDiv({
          cls: "stw-inbox-only",
          text: "Nothing else on the list."
        });
      } else {
        this.renderEmpty();
      }
      if (!this.search.trim()) {
        this.renderUndatedHint();
        this.renderParkedHint();
      }
      return;
    }
    if (this.searchEverywhere)
      this.renderSearchScopeNote(tasks);
    if (this.mode === "lanes")
      this.renderLanes(tasks, today);
    else if (this.mode === "sweep")
      this.renderSweep(tasks, today);
    else
      this.renderFocus(tasks, today);
    if (!this.searchEverywhere) {
      this.renderUndatedHint();
      this.renderParkedHint();
    }
    this.renderSearchElsewhereHint(tasks);
  }
  /** Banner for unfiltered search: the chips above are not in force. */
  renderSearchScopeNote(tasks) {
    const note = this.bodyEl.createDiv({ cls: "stw-undated-hint" });
    const done = tasks.filter((t) => t.status === "done").length;
    note.createSpan({
      text: `Every match for "${this.search.trim()}" \u2014 When and effort filters are off` + (done > 0 ? `, including ${done} completed.` : ".")
    });
    const btn = note.createEl("button", { cls: "stw-undated-btn", text: "Back to filters" });
    btn.addEventListener("click", () => {
      this.searchEverywhere = false;
      this.renderFilters();
      this.render();
    });
  }
  /**
   * The list has matches, but so does the rest of the vault.
   *
   * Without this, a search that finds one of three gala tasks looks complete.
   * The count is the whole point: it's the difference between "that's all of
   * it" and "there's more, one click away".
   */
  renderSearchElsewhereHint(shown) {
    if (!this.search.trim() || this.searchEverywhere)
      return;
    const all = matchesSearch(this.listTasks, this.search);
    const hidden = all.length - shown.length;
    if (hidden <= 0)
      return;
    const hint = this.bodyEl.createDiv({ cls: "stw-undated-hint" });
    hint.createSpan({
      text: `${hidden} more match${hidden === 1 ? "" : "es"} outside ${this.horizonLabel()} \u2014 ${this.describeMatches(all.filter((t) => !shown.includes(t))) || "filtered out"}.`
    });
    const btn = hint.createEl("button", { cls: "stw-undated-btn", text: "Show all matches" });
    btn.addEventListener("click", () => this.showAllMatches());
  }
  horizonLabel() {
    switch (this.horizon) {
      case "today":
        return "Today";
      case "week":
        return "This week";
      case "done":
        return "Done";
      default:
        return "the current filters";
    }
  }
  /** "2 completed, 1 with no due date" — why those matches aren't on the list. */
  describeMatches(tasks) {
    const done = tasks.filter((t) => t.status === "done").length;
    const undated = tasks.filter((t) => t.status === "open" && !t.due).length;
    const other = tasks.length - done - undated;
    const parts = [];
    if (done > 0)
      parts.push(`${done} completed`);
    if (undated > 0)
      parts.push(`${undated} with no due date`);
    if (other > 0)
      parts.push(`${other} dated outside the window`);
    return parts.join(", ");
  }
  /**
   * Say what the When filter is holding back.
   *
   * Today and This Week both require a due date, so a task with no date is
   * invisible in either — and because the list isn't *empty*, the empty state
   * never gets a chance to explain. That's how tracking a project note can
   * report "10 open tasks" and show you nothing: a shopping list has no due
   * dates. The count is only drawn when something is actually hidden, so it
   * stays silent on a fully dated list.
   */
  renderUndatedHint() {
    if (this.horizon !== "today" && this.horizon !== "week")
      return;
    const hidden = this.listTasks.filter(
      (t) => t.status === "open" && !t.due && !isResting(t) && matchesCategory(t, this.category) && fitsBudget(t, this.budget)
    ).length;
    if (hidden === 0)
      return;
    const hint = this.bodyEl.createDiv({ cls: "stw-undated-hint" });
    hint.createSpan({
      text: `${hidden} undated task${hidden === 1 ? "" : "s"} hidden \u2014 ${this.horizon === "today" ? "Today" : "This week"} only shows work with a date.`
    });
    const btn = hint.createEl("button", { cls: "stw-undated-btn", text: "Show all" });
    btn.addEventListener("click", () => {
      this.horizon = "all";
      this.renderFilters();
      void this.refresh();
    });
  }
  /**
   * Say how many tasks are parked, and offer the one click to them.
   *
   * All now excludes anything deferred more than a week out. That's the right
   * default — a task that comes back in January is not today's list — but a
   * filter that silently removes work is indistinguishable from a bug, which
   * is the exact complaint this release is fixing. So: state the count.
   */
  renderParkedHint() {
    if (this.horizon !== "all")
      return;
    const parked = this.listTasks.filter(
      (t) => t.status === "open" && isParked(t) && matchesCategory(t, this.category) && fitsBudget(t, this.budget)
    ).length;
    if (parked === 0)
      return;
    const hint = this.bodyEl.createDiv({ cls: "stw-undated-hint" });
    hint.createSpan({
      text: `${parked} task${parked === 1 ? "" : "s"} deferred more than a week out.`
    });
    const btn = hint.createEl("button", { cls: "stw-undated-btn", text: "Show deferred" });
    btn.addEventListener("click", () => {
      this.horizon = "deferred";
      this.renderFilters();
      void this.refresh();
    });
  }
  // --- Inbox ---------------------------------------------------------------
  //
  // 0.9. Before this, captures from the Stream voice ring landed in the same
  // merged list as everything else, with no way to tell triaged from
  // untriaged and no way to promote one except cutting the line by hand in
  // the note. The split existed on disk (a file only the ingest script writes)
  // but not in the UI, which made it a write-safety boundary and nothing more.
  //
  // Three verbs, because that's all triage is: Keep it (move it into the
  // working list), Edit it (it arrived half-formed), Drop it (never mind).
  renderInbox(inbox, today) {
    const wrap = this.bodyEl.createDiv({ cls: "stw-inbox" });
    const head = wrap.createDiv({ cls: "stw-inbox-head" });
    const caret = head.createSpan({ cls: "stw-inbox-caret" });
    (0, import_obsidian10.setIcon)(caret, this.inboxOpen ? "chevron-down" : "chevron-right");
    head.createSpan({ cls: "stw-inbox-title", text: "Inbox" });
    head.createSpan({ cls: "stw-inbox-count", text: String(inbox.length) });
    head.setAttr(
      "aria-label",
      `${inbox.length} untriaged capture${inbox.length === 1 ? "" : "s"} \u2014 click to ${this.inboxOpen ? "collapse" : "expand"}`
    );
    head.addEventListener("click", () => {
      this.inboxOpen = !this.inboxOpen;
      this.render();
    });
    if (!this.inboxOpen)
      return;
    wrap.createDiv({
      cls: "stw-inbox-note",
      text: "Captured, not yet decided. Keep moves it onto the list."
    });
    for (const task of inbox)
      this.renderInboxRow(wrap, task, today);
  }
  /**
   * A triage row. No checkbox: ticking a capture off is the ambiguous act —
   * did you do it, or did you decide it wasn't real? Keep and Drop answer
   * that, and the size/category chips are live so the one thing triage
   * actually needs (how big is this?) can be set without leaving the row.
   */
  renderInboxRow(parent, task, today) {
    const row = parent.createDiv({ cls: "stw-inbox-row" });
    const titleEl = row.createDiv({
      cls: "stw-task-title",
      text: displayTitle(task.title) || "(untitled capture)"
    });
    titleEl.setAttr("title", `Click to edit \xB7 ${task.filePath}:${task.lineNumber + 1}`);
    titleEl.addEventListener("click", () => this.openEditor(task));
    const meta = row.createDiv({ cls: "stw-task-meta" });
    this.renderCategoryChip(meta, task);
    this.renderEffortPill(meta, task);
    if (task.due) {
      meta.createSpan({ cls: "stw-date", text: this.humanDate(task.due, today) });
    }
    const actions = row.createDiv({ cls: "stw-inbox-actions" });
    const target = this.plugin.primaryFile;
    const keep = actions.createEl("button", { cls: "stw-inbox-btn is-keep", text: "Keep" });
    keep.setAttr("aria-label", `Move it into ${target}`);
    keep.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      keep.disabled = true;
      const ok = await safeWrite(() => moveTaskLine(this.app, task, target));
      if (ok)
        new import_obsidian10.Notice(`Smart ToDo: kept \u2192 ${target}`, 3e3);
      await this.refresh();
    });
    const edit = actions.createEl("button", { cls: "stw-inbox-btn", text: "Edit" });
    edit.setAttr("aria-label", `Fix the wording, size or date \u2014 saving keeps it in ${target}`);
    edit.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.openEditor(task);
    });
    const drop = actions.createEl("button", { cls: "stw-inbox-btn is-drop", text: "Drop" });
    drop.setAttr("aria-label", "Let it go \u2014 the line stays, ticked and dated");
    drop.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      drop.disabled = true;
      await safeWrite(() => dropTask(this.app, task));
      await this.refresh();
    });
  }
  renderEmpty() {
    const empty = this.bodyEl.createDiv({ cls: "stw-empty" });
    if (this.listTasks.length === 0) {
      empty.createDiv({ cls: "stw-empty-head", text: "No tasks in scope." });
      empty.createDiv({
        cls: "stw-empty-note",
        text: `Watching ${describeScope(this.plugin.scope)}`
      });
      return;
    }
    if (this.search.trim()) {
      const term = this.search.trim();
      const elsewhere = this.searchEverywhere ? [] : matchesSearch(this.listTasks, term);
      if (elsewhere.length > 0) {
        empty.createDiv({
          cls: "stw-empty-head",
          text: `No "${term}" under ${this.horizonLabel()}.`
        });
        empty.createDiv({
          cls: "stw-empty-note",
          text: `${elsewhere.length} match${elsewhere.length === 1 ? "" : "es"} elsewhere \u2014 ${this.describeMatches(elsewhere) || "filtered out"}.`
        });
        const btn = empty.createEl("button", { cls: "stw-btn", text: "Show all matches" });
        btn.addEventListener("click", () => this.showAllMatches());
        return;
      }
      empty.createDiv({ cls: "stw-empty-head", text: `Nothing matches "${term}".` });
      empty.createDiv({ cls: "stw-empty-note", text: "Press Enter to add it as a task." });
      return;
    }
    if (this.budget !== "any") {
      const untagged = this.listTasks.filter(
        (t) => matchesHorizon(t, this.horizon) && matchesCategory(t, this.category) && !t.effort
      ).length;
      empty.createDiv({ cls: "stw-empty-head", text: "Nothing fits that window." });
      if (untagged > 0) {
        empty.createDiv({
          cls: "stw-empty-note",
          text: `${untagged} task${untagged === 1 ? " has" : "s have"} no effort set, so ${untagged === 1 ? "it isn't" : "they aren't"} offered here.`
        });
        const btn = empty.createEl("button", { cls: "stw-btn", text: "Show anything" });
        btn.addEventListener("click", () => {
          this.budget = "any";
          this.renderFilters();
          this.render();
        });
      }
      return;
    }
    if (this.horizon === "today" || this.horizon === "week") {
      const undated = this.listTasks.filter(
        (t) => t.status === "open" && !t.due && matchesCategory(t, this.category)
      ).length;
      if (undated > 0) {
        empty.createDiv({ cls: "stw-empty-head", text: "Nothing dated for that window." });
        empty.createDiv({
          cls: "stw-empty-note",
          text: `${undated} open task${undated === 1 ? " has" : "s have"} no due date, so ${undated === 1 ? "it doesn't" : "they don't"} show under ${this.horizon === "today" ? "Today" : "This week"}.`
        });
        const btn = empty.createEl("button", { cls: "stw-btn", text: "Show all" });
        btn.addEventListener("click", () => {
          this.horizon = "all";
          this.renderFilters();
          void this.refresh();
        });
        return;
      }
    }
    empty.createDiv({ cls: "stw-empty-head", text: "Nothing here. Clear." });
  }
  /**
   * Focus: one list, sectioned by Eisenhower quadrant, with a count and a time
   * estimate on each header. The quick-wins banner sits after the first
   * section — close enough to the top to be a real offer, far enough down that
   * the important work is still what you read first.
   */
  renderFocus(tasks, today) {
    const split = groupBySource(tasks, (p) => this.isHomeFile(p));
    const grouped = groupByQuadrant(split.main, today);
    const quickies = tasks.filter((t) => t.effort === "light" && !isContainer(t));
    let bannerPlaced = false;
    for (const q of QUADRANT_ORDER) {
      const group = grouped[q];
      if (group.length === 0)
        continue;
      const def = QUADRANTS.find((d) => d.id === q);
      const head = this.bodyEl.createDiv({ cls: `stw-group-head is-${q}` });
      head.style.setProperty("--quad-color", QUADRANT_COLOR[q]);
      head.createSpan({ cls: "stw-group-title", text: def.label });
      const minutes = estimateMinutes(group);
      head.createSpan({
        cls: "stw-group-tally",
        text: minutes > 0 ? `${group.length} \xB7 ${formatDuration(minutes)}` : String(group.length)
      });
      head.setAttr("aria-label", def.advice);
      for (const task of group)
        this.renderRow(this.bodyEl, task, today);
      if (!bannerPlaced && this.plugin.settings.showSweepBanner && quickies.length >= 2 && group.length > 0) {
        this.renderSweepBanner(quickies);
        bannerPlaced = true;
      }
    }
    for (const group of split.groups)
      this.renderSourceGroup(group, today);
    if (!bannerPlaced && this.plugin.settings.showSweepBanner && quickies.length >= 2) {
      this.renderSweepBanner(quickies);
    }
  }
  /** Tracker and inbox are "home"; anything else is a tracked project note. */
  isHomeFile(path) {
    return samePath(path, this.plugin.primaryFile) || samePath(path, this.plugin.inboxPath);
  }
  /** The heading for a tracked note's group — renamed label, else the filename. */
  sourceLabel(path) {
    var _a2, _b, _c, _d;
    const custom = (_b = (_a2 = this.plugin.settings.sourceLabels) == null ? void 0 : _a2[path]) == null ? void 0 : _b.trim();
    if (custom)
      return custom;
    return (_d = (_c = path.split("/").pop()) == null ? void 0 : _c.replace(/\.md$/i, "")) != null ? _d : path;
  }
  isSourceCollapsed(path) {
    var _a2;
    return ((_a2 = this.plugin.settings.collapsedSources) != null ? _a2 : []).includes(path);
  }
  /**
   * One tracked note, folded under its own heading.
   *
   * The count stays on the header when it's shut, which is the whole bargain:
   * folding is "not now", not "gone". Click the header to fold; right-click to
   * rename it, open the note, or stop tracking.
   */
  renderSourceGroup(group, today) {
    const collapsed = this.isSourceCollapsed(group.path);
    const label = this.sourceLabel(group.path);
    const head = this.bodyEl.createDiv({
      cls: `stw-source-head${collapsed ? " is-collapsed" : ""}`
    });
    const caret = head.createSpan({ cls: "stw-source-caret" });
    (0, import_obsidian10.setIcon)(caret, collapsed ? "chevron-right" : "chevron-down");
    (0, import_obsidian10.setIcon)(head.createSpan({ cls: "stw-source-head-icon" }), "file-text");
    head.createSpan({ cls: "stw-source-title", text: label });
    const minutes = estimateMinutes(group.tasks);
    head.createSpan({
      cls: "stw-source-tally",
      text: minutes > 0 ? `${group.tasks.length} \xB7 ${formatDuration(minutes)}` : String(group.tasks.length)
    });
    head.setAttr(
      "aria-label",
      `${group.tasks.length} task${group.tasks.length === 1 ? "" : "s"} from ${group.path} \u2014 click to ${collapsed ? "expand" : "fold"}, right-click to rename`
    );
    head.addEventListener("click", () => void this.toggleSource(group.path));
    head.addEventListener("contextmenu", (evt) => {
      var _a2;
      evt.preventDefault();
      evt.stopPropagation();
      const menu = new import_obsidian10.Menu();
      menu.addItem(
        (item) => item.setTitle("Rename this group\u2026").setIcon("pencil").onClick(() => this.renameSource(group.path, head))
      );
      if ((_a2 = this.plugin.settings.sourceLabels) == null ? void 0 : _a2[group.path]) {
        menu.addItem(
          (item) => item.setTitle("Use the note's name").setIcon("rotate-ccw").onClick(() => void this.setSourceLabel(group.path, ""))
        );
      }
      menu.addItem(
        (item) => item.setTitle("Open the note").setIcon("file-text").onClick(() => void this.revealTask(group.tasks[0]))
      );
      menu.addItem(
        (item) => item.setTitle("Stop tracking this note").setIcon("x").onClick(() => void this.plugin.toggleTracked(group.path))
      );
      menu.showAtMouseEvent(evt);
    });
    if (collapsed)
      return;
    if (!this.plugin.settings.groupByHeading) {
      for (const task of group.tasks)
        this.renderTree(group.tasks, task, today);
      return;
    }
    const sections = groupByHeading(group.tasks);
    for (const section of sections) {
      if (section.heading && sections.length > 1) {
        const sub = this.bodyEl.createDiv({ cls: "stw-heading-head" });
        sub.createSpan({ cls: "stw-heading-title", text: section.heading });
        sub.createSpan({ cls: "stw-heading-tally", text: String(section.tasks.length) });
      }
      for (const task of section.tasks)
        this.renderTree(section.tasks, task, today);
    }
  }
  /**
   * Render a task at its nesting depth, but only once.
   *
   * `parseTasksFromContent` returns a flat list with `parentLine` pointing up,
   * so the tree is already there — this just skips any task whose parent is in
   * the same visible set (the parent's own call renders it) and indents the
   * rest. The alternative, rendering children as peers, loses the one thing the
   * indentation on the page was saying: *this is how that gets done*.
   */
  renderTree(siblings, task, today) {
    const depth = this.visibleDepth(siblings, task);
    if (depth < 0)
      return;
    this.renderRow(this.bodyEl, task, today, { hideSource: true, depth });
  }
  /** Indent level relative to the shallowest visible ancestor chain, or -1. */
  visibleDepth(siblings, task) {
    let depth = 0;
    let current = task;
    for (let i = 0; i < 8; i++) {
      const parent = siblings.find(
        (s) => s.filePath === current.filePath && s.lineNumber === current.parentLine
      );
      if (!parent)
        break;
      depth++;
      current = parent;
    }
    return Math.min(depth, 3);
  }
  async toggleSource(path) {
    var _a2;
    const current = (_a2 = this.plugin.settings.collapsedSources) != null ? _a2 : [];
    this.plugin.settings.collapsedSources = current.includes(path) ? current.filter((p) => p !== path) : [...current, path];
    await this.plugin.saveSettings();
    this.render();
  }
  async setSourceLabel(path, label) {
    var _a2;
    const labels = { ...(_a2 = this.plugin.settings.sourceLabels) != null ? _a2 : {} };
    if (label.trim())
      labels[path] = label.trim();
    else
      delete labels[path];
    this.plugin.settings.sourceLabels = labels;
    await this.plugin.saveSettings();
    this.render();
  }
  /** Rename in place: the header becomes an input, Enter commits, Esc cancels. */
  renameSource(path, head) {
    head.empty();
    const input = head.createEl("input", {
      cls: "stw-source-rename",
      attr: { type: "text", value: this.sourceLabel(path), placeholder: "Group name" }
    });
    input.addEventListener("click", (evt) => evt.stopPropagation());
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        void this.setSourceLabel(path, input.value);
      } else if (evt.key === "Escape") {
        evt.preventDefault();
        this.render();
      }
    });
    input.addEventListener("blur", () => void this.setSourceLabel(path, input.value));
    input.focus();
    input.select();
  }
  /**
   * A tiny ring, drawn beside any time estimate.
   *
   * Deliberately the same motif as the sweep timer's countdown ring, so the
   * "about 27m" on the banner and the "2:14 / of 3:00" you see mid-sweep read
   * as the same idea at two sizes. A partial arc rather than a full circle —
   * a complete ring looks like a status dot, an arc looks like elapsed time.
   */
  renderTimeGlyph(parent) {
    const svg = parent.createSvg("svg", {
      cls: "stw-time-glyph",
      attr: {
        viewBox: "0 0 16 16",
        width: "12",
        height: "12",
        "aria-hidden": "true",
        focusable: "false"
      }
    });
    const ring = { cx: "8", cy: "8", r: "6", fill: "none", "stroke-width": "2" };
    svg.createSvg("circle", { cls: "stw-time-glyph-track", attr: { ...ring } });
    svg.createSvg("circle", {
      cls: "stw-time-glyph-arc",
      attr: {
        ...ring,
        "stroke-linecap": "round",
        // r=6 → circumference 37.7; 26.4 ≈ 70% of the way round.
        "stroke-dasharray": "26.4 37.7",
        transform: "rotate(-90 8 8)"
      }
    });
  }
  /**
   * The quick-wins banner. This is the element that most changes behaviour:
   * it names the pile of small stuff as a single batch with a duration and a
   * button, which is the difference between "41 open tasks" and "ten minutes".
   */
  renderSweepBanner(quickies) {
    const banner = this.bodyEl.createDiv({ cls: "stw-sweep-banner" });
    const icon = banner.createSpan({ cls: "stw-sweep-banner-icon" });
    (0, import_obsidian10.setIcon)(icon, "zap");
    const text = banner.createDiv({ cls: "stw-sweep-banner-text" });
    text.createDiv({
      cls: "stw-sweep-banner-head",
      text: `${quickies.length} quick win${quickies.length === 1 ? "" : "s"}`
    });
    const sub = text.createDiv({ cls: "stw-sweep-banner-sub" });
    this.renderTimeGlyph(sub);
    sub.createSpan({ text: `about ${formatDuration(estimateMinutes(quickies))}` });
    const btn = banner.createEl("button", { cls: "stw-sweep-banner-btn", text: "Sweep" });
    btn.addEventListener("click", () => this.startSweep(quickies));
  }
  /** Sweep mode: the queue, previewed, with one button that starts the clock. */
  renderSweep(tasks, today) {
    const queue = tasks.filter((t) => t.effort === "light" && !isContainer(t));
    const head = this.bodyEl.createDiv({ cls: "stw-sweep-intro" });
    head.createDiv({
      cls: "stw-sweep-intro-head",
      text: queue.length === 0 ? "Nothing under 3 minutes." : "Everything under 3 minutes"
    });
    const sub = head.createDiv({ cls: "stw-sweep-intro-sub" });
    if (queue.length === 0) {
      sub.createSpan({ text: "Tag a task's effort as 3 min and it shows up here." });
    } else {
      this.renderTimeGlyph(sub);
      sub.createSpan({
        text: `${queue.length} task${queue.length === 1 ? "" : "s"} \xB7 about ${formatDuration(
          estimateMinutes(queue)
        )}`
      });
    }
    if (queue.length > 0) {
      const btn = head.createEl("button", { cls: "stw-btn is-primary", text: "Start sweep" });
      btn.addEventListener("click", () => this.startSweep(queue));
    }
    for (const task of queue)
      this.renderRow(this.bodyEl, task, today);
  }
  startSweep(queue) {
    new SweepModal(
      this.app,
      queue,
      this.plugin.settings.sweepSeconds,
      () => void this.refresh()
    ).open();
  }
  /**
   * Start a sweep over whatever is currently in scope, for the command palette.
   *
   * Deliberately built from `visibleTasks()` rather than the whole vault: if
   * you've narrowed to Betaworks, a sweep you start from the keyboard should
   * be the Betaworks quick wins, not every loose end you own.
   */
  sweepNow() {
    const queue = this.visibleTasks().filter((t) => t.effort === "light" && !isContainer(t));
    if (queue.length === 0)
      return false;
    this.startSweep(queue);
    return true;
  }
  /**
   * Lanes: the kanban-by-size view from the mockups. In a narrow sidebar the
   * columns become stacked sections with a sticky header; in a wide leaf they
   * sit side by side. Same DOM either way — it's a CSS decision, not a mode.
   */
  renderLanes(tasks, today) {
    const lanes = this.bodyEl.createDiv({ cls: "stw-lanes" });
    for (const effort of EFFORTS) {
      const group = tasks.filter((t) => t.effort === effort);
      const lane2 = lanes.createDiv({ cls: `stw-lane is-${effort}` });
      const head2 = lane2.createDiv({ cls: "stw-lane-head" });
      head2.createSpan({ cls: "stw-lane-title", text: EFFORT_LABEL[effort] });
      head2.createSpan({
        cls: "stw-lane-tally",
        text: group.length === 0 ? "\u2014" : `${group.length} \xB7 ${formatDuration(group.length * EFFORT_MINUTES[effort])}`
      });
      head2.createDiv({ cls: "stw-lane-blurb", text: EFFORT_BLURB[effort] });
      const body2 = lane2.createDiv({ cls: "stw-lane-body" });
      if (group.length === 0) {
        body2.createDiv({ cls: "stw-lane-empty", text: "Empty" });
        continue;
      }
      for (const task of group)
        this.renderRow(body2, task, today);
    }
    const untagged = tasks.filter((t) => !t.effort);
    if (untagged.length === 0)
      return;
    const lane = lanes.createDiv({ cls: "stw-lane is-untagged" });
    const head = lane.createDiv({ cls: "stw-lane-head" });
    head.createSpan({ cls: "stw-lane-title", text: "Unsized" });
    head.createSpan({ cls: "stw-lane-tally", text: String(untagged.length) });
    head.createDiv({ cls: "stw-lane-blurb", text: "No effort set \u2014 hidden from budgets" });
    const body = lane.createDiv({ cls: "stw-lane-body" });
    for (const task of untagged)
      this.renderRow(body, task, today);
  }
  // --- Row -----------------------------------------------------------------
  renderRow(parent, task, today, opts = {}) {
    var _a2;
    const row = parent.createDiv({ cls: "stw-row-task" });
    if (opts.depth) {
      row.addClass("is-child");
      row.style.setProperty("--stw-depth", String(opts.depth));
    }
    if (isContainer(task))
      row.addClass("is-container");
    if (task.status === "done")
      row.addClass("is-done");
    if (task.due && task.due.getTime() < today.getTime() && task.status === "open") {
      row.addClass("is-overdue");
    }
    if (isResting(task, today))
      row.addClass("is-resting");
    const checkbox = row.createEl("input", {
      cls: "stw-check",
      attr: { type: "checkbox" }
    });
    checkbox.checked = task.status === "done";
    checkbox.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      checkbox.disabled = true;
      const ok = await safeWrite(() => toggleTaskDone(this.app, task, task.status === "open"));
      if (!ok)
        checkbox.checked = task.status === "done";
      await this.refresh();
    });
    const main = row.createDiv({ cls: "stw-task-main" });
    const titleEl = main.createDiv({
      cls: "stw-task-title",
      text: displayTitle(task.title) || "(untitled task)"
    });
    titleEl.addEventListener("click", () => this.openEditor(task));
    titleEl.setAttr("title", `Click to edit \xB7 ${task.filePath}:${task.lineNumber + 1}`);
    const meta = main.createDiv({ cls: "stw-task-meta" });
    if (!opts.depth)
      this.renderParentChip(meta, task);
    if (isContainer(task)) {
      meta.createSpan({
        cls: "stw-subcount",
        text: `${task.openChildren} open`,
        attr: { "aria-label": "This has sub-tasks \u2014 the work is in those" }
      });
    }
    if (task.important === true && task.importantFrom && task.importantFrom !== "field") {
      const from = task.importantFrom;
      meta.createSpan({
        cls: "stw-why",
        text: from === "priority" ? PRIORITY_MARK[(_a2 = task.priority) != null ? _a2 : "medium"] : from === "heading" ? "\xA7" : "\u21B3",
        attr: {
          "aria-label": from === "priority" ? `Important: priority ${task.priority} on the line` : from === "heading" ? `Important: under "${task.heading}"` : "Important: inherited from the task above",
          title: from === "priority" ? `Marked ${task.priority} priority in the note` : from === "heading" ? `Under the heading "${task.heading}"` : "Inherited from its parent task"
        }
      });
    }
    this.renderCategoryChip(meta, task);
    if (!opts.hideSource)
      this.renderSourceChip(meta, task);
    this.renderEffortPill(meta, task);
    if (task.due) {
      meta.createSpan({ cls: "stw-date", text: this.humanDate(task.due, today) });
    }
    if (isResting(task, today)) {
      meta.createSpan({
        cls: "stw-date is-defer",
        text: `deferred until ${this.humanDate(task.defer, today)}`
      });
    }
    if (task.pushes > 0) {
      const warn = task.pushes >= this.plugin.settings.pushesWarnThreshold;
      meta.createSpan({
        cls: `stw-pushes${warn ? " is-warn" : ""}`,
        text: `\u21BB ${task.pushes}`,
        attr: {
          "aria-label": `Pushed ${task.pushes} ${task.pushes === 1 ? "time" : "times"}`
        }
      });
    }
    if (task.assigned) {
      meta.createSpan({ cls: "stw-assigned", text: `@${task.assigned}` });
    }
    if (task.dropped) {
      meta.createSpan({ cls: "stw-date is-dropped", text: `dropped ${formatDate(task.dropped)}` });
    } else if (task.status === "done" && task.doneDate) {
      meta.createSpan({ cls: "stw-date", text: `done ${formatDate(task.doneDate)}` });
    }
    const actions = row.createDiv({ cls: "stw-task-actions" });
    this.renderImportanceToggle(actions, task);
    if (task.status === "open") {
      const pushBtn = actions.createEl("button", {
        cls: "stw-icon-btn is-ghost",
        attr: {
          "aria-label": "Push to tomorrow \u2014 right-click for longer",
          title: "Push to tomorrow (defer until then). Right-click for longer."
        }
      });
      (0, import_obsidian10.setIcon)(pushBtn, "chevrons-right");
      pushBtn.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        pushBtn.disabled = true;
        await this.push(task, 1);
      });
      pushBtn.addEventListener("contextmenu", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const menu = new import_obsidian10.Menu();
        for (const [days, label] of [
          [1, "Tomorrow"],
          [2, "In 2 days"],
          [7, "Next week"]
        ]) {
          menu.addItem(
            (item) => item.setTitle(label).onClick(() => void this.push(task, days))
          );
        }
        menu.showAtMouseEvent(evt);
      });
    }
  }
  /**
   * Push and say what happened.
   *
   * The notice exists because the effect is deliberately invisible in the place
   * you clicked: a pushed task leaves Do First and drops out of Today, which
   * from the row's point of view looks identical to nothing happening. One line
   * naming the new date — and the section it moved to — is the difference.
   */
  async push(task, days) {
    const ok = await safeWrite(() => pushTask(this.app, task, days));
    if (ok) {
      const when = pushTargetDate(task, days);
      new import_obsidian10.Notice(
        `Pushed to ${this.humanDate(when, startOfToday())} \u2014 deferred until then, so it's out of Do First.`,
        4e3
      );
    }
    await this.refresh();
  }
  /**
   * The size control. Effort reads as a duration, not a weight class — "3 min"
   * is a fact you can act on, "Light" was a label you had to translate first.
   * Unsized shows "+ size" rather than nothing, because an unsized task is
   * invisible to every budget filter and that needs to be fixable in place.
   */
  renderEffortPill(parent, task) {
    const open = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.showEffortMenu(evt, task);
    };
    if (!task.effort) {
      const unset = parent.createSpan({ cls: "stw-effort is-unset", text: "+ size" });
      unset.addEventListener("click", open);
      return;
    }
    const pill = parent.createSpan({
      cls: `stw-effort is-${task.effort}`,
      attr: { "aria-label": "Click to change" }
    });
    if (task.effort === "light")
      (0, import_obsidian10.setIcon)(pill.createSpan({ cls: "stw-effort-bolt" }), "zap");
    pill.createSpan({ text: EFFORT_LABEL[task.effort] });
    pill.addEventListener("click", open);
    pill.addEventListener("contextmenu", open);
  }
  /**
   * Importance. Three states cycle on click:
   *   unjudged (?) → important (★) → not important (☆) → unjudged
   * Right-click clears to unjudged. This is the only control that sets the
   * "important" axis; urgency is always derived from the due date.
   */
  renderImportanceToggle(parent, task) {
    const state = task.important === true ? "yes" : task.important === false ? "no" : "unjudged";
    const star = parent.createSpan({
      cls: `stw-star is-${state}`,
      attr: {
        "aria-label": state === "yes" ? "important" : state === "no" ? "not important" : "set importance"
      }
    });
    (0, import_obsidian10.setIcon)(star, SPIRAL_ICON_ID);
    star.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const next = task.important === null ? true : task.important === true ? false : null;
      void safeWrite(() => setTaskImportant(this.app, task, next)).then(() => this.refresh());
    });
    star.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void safeWrite(() => setTaskImportant(this.app, task, null)).then(() => this.refresh());
    });
  }
  showEffortMenu(evt, task) {
    const menu = new import_obsidian10.Menu();
    for (const effort of EFFORTS) {
      menu.addItem(
        (item) => item.setTitle(EFFORT_LABEL[effort]).setChecked(task.effort === effort).onClick(async () => {
          await safeWrite(() => setTaskEffort(this.app, task, effort));
          await this.refresh();
        })
      );
    }
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle("Clear size").onClick(async () => {
        await safeWrite(() => setTaskEffort(this.app, task, null));
        await this.refresh();
      })
    );
    menu.showAtMouseEvent(evt);
  }
  /**
   * Where a task came from, when that isn't obvious.
   *
   * Most rows live in the tracker or the inbox and naming the file would be
   * noise on every line. A task pulled in from a tracked project note is
   * different: "Buy peanut oil" makes sense only once you know it's from the
   * Turkey Fry Prep page, and ticking it here ticks the checkbox *there*, so
   * the panel should say so. Clicking jumps to the line.
   */
  renderSourceChip(parent, task) {
    var _a2, _b;
    if (samePath(task.filePath, this.plugin.primaryFile))
      return;
    if (samePath(task.filePath, this.plugin.inboxPath))
      return;
    const name = (_b = (_a2 = task.filePath.split("/").pop()) == null ? void 0 : _a2.replace(/\.md$/i, "")) != null ? _b : task.filePath;
    const chip = parent.createSpan({
      cls: "stw-source-chip",
      attr: { "aria-label": `From ${task.filePath} \u2014 click to open` }
    });
    (0, import_obsidian10.setIcon)(chip.createSpan({ cls: "stw-source-icon" }), "file-text");
    chip.createSpan({ text: name });
    chip.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void this.revealTask(task);
    });
  }
  /**
   * The nearest ancestor task, from the full scan rather than the visible set.
   *
   * Walks the whole chain and takes the *top* of it, not the immediate parent:
   * two levels of indent under "Fund 4 build to 30M" is still Fund 4 work, and
   * naming the middle step tells you less than naming the project does.
   */
  rootProject(task) {
    let current = task;
    let root = null;
    for (let i = 0; i < 8; i++) {
      if (current.parentLine === null || current.parentLine === void 0)
        break;
      const parent = this.tasks.find(
        (t) => t.filePath === current.filePath && t.lineNumber === current.parentLine
      );
      if (!parent)
        break;
      root = parent;
      current = parent;
    }
    return root;
  }
  renderParentChip(parent, task) {
    const project = this.rootProject(task);
    if (!project)
      return;
    const label = displayTitle(project.title).trim();
    if (!label)
      return;
    const chip = parent.createSpan({
      cls: "stw-parent-chip",
      attr: {
        "aria-label": `Part of \u201C${label}\u201D \u2014 click to open it`,
        title: `Part of \u201C${label}\u201D`
      }
    });
    chip.createSpan({ cls: "stw-parent-mark", text: "\u21B3" });
    chip.createSpan({ cls: "stw-parent-label", text: label });
    chip.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void this.revealTask(project);
    });
  }
  renderCategoryChip(parent, task) {
    const chip = parent.createSpan({ cls: "stw-cat-chip" });
    const canonical = asCategory(task.project);
    if (canonical) {
      chip.createSpan({
        cls: "stw-dot",
        attr: { style: `background:${CATEGORY_COLOR[canonical]}` }
      });
      chip.createSpan({ text: CATEGORY_LABEL[canonical] });
    } else if (task.project) {
      chip.addClass("is-legacy");
      chip.createSpan({
        cls: "stw-dot",
        attr: { style: `background:${projectColor(task.project)}` }
      });
      chip.createSpan({ text: task.project });
      chip.setAttr("aria-label", "Not one of the three categories \u2014 click to set");
    } else {
      chip.addClass("is-unset");
      chip.setText("+ category");
    }
    chip.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.showCategoryMenu(evt, task);
    });
  }
  showCategoryMenu(evt, task) {
    const current = asCategory(task.project);
    const menu = new import_obsidian10.Menu();
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
  /**
   * Open the editor — and, for an untriaged capture, make Save decide.
   *
   * Triage has three answers and editing isn't a fourth one. Nobody fixes the
   * wording, sets a size and picks a category on something they then intend to
   * leave sitting in the Inbox; the work of deciding is already done by the
   * time you hit Save. So a saved capture is a kept capture, in one write —
   * the patched line goes straight to the tracker rather than being written
   * back to the inbox and moved a second time. Drop is still the way to say no.
   */
  openEditor(task) {
    const target = this.plugin.primaryFile;
    const keeps = this.plugin.isInboxTask(task) && !samePath(task.filePath, target);
    new EditTaskModal(
      this.app,
      task,
      async (patch) => {
        if (keeps) {
          const line = buildPatchedLine(task, patch);
          const ok = await safeWrite(() => moveTaskLine(this.app, task, target, line));
          if (ok)
            new import_obsidian10.Notice(`Smart ToDo: kept \u2192 ${target}`, 3e3);
          await this.refresh();
          return;
        }
        if (Object.keys(patch).length === 0)
          return;
        await safeWrite(() => applyTaskPatch(this.app, task, patch));
        await this.refresh();
      },
      () => void this.revealTask(task),
      keeps ? target : null
    ).open();
  }
  async revealTask(task) {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(this.app.vault.getAbstractFileByPath(task.filePath), {
      eState: { line: task.lineNumber }
    });
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
    if (days <= 6)
      return date.toLocaleDateString(void 0, { weekday: "short" });
    return formatDate(date);
  }
};

// src/categorize.ts
var import_obsidian11 = require("obsidian");
function planCategoryMigration(tasks) {
  var _a2;
  const changes = [];
  for (const task of tasks) {
    const raw = (_a2 = task.project) == null ? void 0 : _a2.trim();
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
  var _a2, _b;
  const byTarget = /* @__PURE__ */ new Map();
  for (const c of changes) {
    const inner = (_a2 = byTarget.get(c.to)) != null ? _a2 : /* @__PURE__ */ new Map();
    inner.set(c.from, ((_b = inner.get(c.from)) != null ? _b : 0) + 1);
    byTarget.set(c.to, inner);
  }
  return CATEGORIES.filter((cat) => byTarget.has(cat)).map((cat) => ({
    to: cat,
    froms: Array.from(byTarget.get(cat).entries()).map(([from, count]) => ({ from, count })).sort((a, b) => b.count - a.count || a.from.localeCompare(b.from))
  }));
}
var CategoryMigrationModal = class extends import_obsidian11.Modal {
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
var SmartTodoPlugin = class extends import_obsidian12.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.refreshTimer = null;
    /**
     * Registered once, mutated in place.
     *
     * `registerEditorExtension` is one-way — there's no unregister — so toggling
     * the chips setting works by emptying this array and asking the workspace to
     * reconfigure. Registering the extension twice instead would leave two
     * decoration sets fighting over the same ranges.
     */
    this.editorExtensions = [];
  }
  async onload() {
    await this.loadSettings();
    this.applyAccent();
    (0, import_obsidian12.addIcon)(SPIRAL_ICON_ID, SPIRAL_ICON_SVG);
    this.registerEditorExtension(this.editorExtensions);
    this.applyChipExtension();
    this.registerEditorSuggest(new TaskSuggest(this.app, this));
    this.registerView(
      VIEW_TYPE_SMART_TODO,
      (leaf) => new SmartTodoView(leaf, this)
    );
    this.addSettingTab(new SmartTodoSettingTab(this.app, this));
    this.addRibbonIcon(SPIRAL_ICON_ID, "Smart ToDo: Today", () => {
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
      id: "quick-switch",
      name: "Quick switch (filters and tasks)",
      callback: () => {
        void this.withView((view) => view.openPalette());
      }
    });
    this.addCommand({
      id: "start-sweep",
      name: "Start a sweep of the 3-minute tasks",
      callback: () => {
        void this.withView((view) => {
          if (!view.sweepNow()) {
            new import_obsidian12.Notice("Smart ToDo: nothing tagged 3 min in the current filter.", 4e3);
          }
        });
      }
    });
    this.addCommand({
      id: "track-active-note",
      name: "Track tasks in this note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        void this.toggleTracked(file.path);
        return true;
      }
    });
    this.addCommand({
      id: "track-section",
      name: "Track one section of this note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        void this.trackSection(file);
        return true;
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof import_obsidian12.TFile) || file.extension !== "md")
          return;
        if (samePath(file.path, this.primaryFile))
          return;
        const tracked = scopeIncludesPath(this.settings.managedFiles, file.path, this.scopeOptions);
        menu.addItem(
          (item) => item.setTitle(tracked ? "Smart ToDo: stop tracking tasks here" : "Smart ToDo: track tasks in this note").setIcon(SPIRAL_ICON_ID).onClick(() => void this.toggleTracked(file.path))
        );
        menu.addItem(
          (item) => item.setTitle("Smart ToDo: track one section of this note\u2026").setIcon(SPIRAL_ICON_ID).onClick(() => void this.trackSection(file))
        );
      })
    );
    this.addCommand({
      id: "migrate-categories",
      name: "Fold projects into categories (Betaworks / Personal / Health)",
      callback: () => void this.openCategoryMigration()
    });
    this.addCommand({
      id: "archive-backlog",
      name: "Archive every open task in this note (clean slate)",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        void this.openArchiveBacklog(file);
        return true;
      }
    });
    this.app.workspace.onLayoutReady(() => {
      void this.migrateLegacyScopeList();
      void this.ensurePrimaryFile();
    });
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian12.TFile && this.isInManagedScope(file.path)) {
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
    document.body.style.removeProperty("--stw-accent");
    document.body.style.removeProperty("--stw-accent-strong");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  /**
   * Rewrite a comma-separated tracked-files list as one path per line.
   *
   * Runs after layout-ready because the migration asks the vault which
   * reading of `a, b` is a real file — mid-load, `getAbstractFileByPath`
   * answers no for everything and we'd shred a comma-bearing filename into
   * two paths that don't exist, which is the original bug with extra steps.
   */
  async migrateLegacyScopeList() {
    const migrated = splitLegacyCommaList(
      this.settings.managedFiles,
      (path) => this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian12.TFile
    );
    if (migrated === null)
      return;
    this.settings.managedFiles = migrated;
    await this.saveSettings();
    this.scheduleRefresh();
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.applyAccent();
    this.applyChipExtension();
  }
  /**
   * Turn metadata chips on or off without a reload.
   *
   * `updateOptions` is what makes the toggle immediate: it reconfigures every
   * open editor from the (now changed) extension array. Without it the setting
   * would appear to do nothing until Obsidian restarted, which reads as a
   * broken checkbox.
   */
  applyChipExtension() {
    const want = this.settings.metadataChips;
    const on = this.editorExtensions.length > 0;
    if (want === on)
      return;
    this.editorExtensions.length = 0;
    if (want)
      this.editorExtensions.push(metadataChipsExtension());
    this.app.workspace.updateOptions();
  }
  /**
   * Put the accent on `document.body`, not just the panel.
   *
   * Modals mount into `.modal-container` at body level — outside the view's
   * DOM entirely. With the properties set only on the panel, every
   * `var(--stw-accent)` inside the sweep screen resolved to nothing: no
   * progress ring, a grey badge instead of an accent one, and a "Done" button
   * whose background vanished, leaving white text on white. Setting them on
   * body covers every surface the plugin draws, modal or not.
   */
  applyAccent() {
    applyAccentVars(document.body, this.settings.accent);
  }
  /**
   * Add or remove a note from the managed scope.
   *
   * Nothing is copied: the note keeps its own checkboxes and the panel edits
   * them in place, so ticking "Buy peanut oil" in Smart ToDo ticks it on the
   * Turkey Fry Prep page, and ticking it on the page updates the panel. That
   * also means untracking is free — it only stops the scan, it never touches
   * the note.
   */
  async toggleTracked(path, opts = {}) {
    var _a2;
    if (samePath(path, this.primaryFile)) {
      if (!opts.silent) {
        new import_obsidian12.Notice("Smart ToDo: this is the main task file \u2014 it's always tracked.", 4e3);
      }
      return;
    }
    const tracked = scopeIncludesPath(this.settings.managedFiles, path, this.scopeOptions);
    this.settings.managedFiles = tracked ? removePathFromScope(this.settings.managedFiles, path, this.scopeOptions) : addPathToScope(this.settings.managedFiles, path);
    await this.saveSettings();
    this.refreshViews();
    if (opts.silent)
      return;
    const name = (_a2 = path.split("/").pop()) != null ? _a2 : path;
    if (tracked) {
      new import_obsidian12.Notice(`Smart ToDo: no longer tracking ${name}. The note is unchanged.`, 4e3);
      return;
    }
    const open = (await this.scan()).filter(
      (t) => samePath(t.filePath, path) && t.status === "open"
    );
    if (open.length === 0) {
      new import_obsidian12.Notice(`Smart ToDo: tracking ${name} \u2014 no open tasks in it yet.`, 5e3);
      return;
    }
    const undated = open.filter((t) => !t.due).length;
    const unsized = open.filter((t) => !t.effort).length;
    const caveats = [];
    if (undated === open.length)
      caveats.push("none are dated, so set When \u2192 All to see them");
    else if (undated > 0)
      caveats.push(`${undated} undated (hidden under Today)`);
    if (unsized === open.length)
      caveats.push("none are sized, so they only show under the Any budget");
    else if (unsized > 0)
      caveats.push(`${unsized} unsized`);
    new import_obsidian12.Notice(
      `Smart ToDo: tracking ${name} \u2014 ${open.length} open task${open.length === 1 ? "" : "s"}.` + (caveats.length > 0 ? ` ${caveats.join("; ")}.` : ""),
      8e3
    );
  }
  /**
   * Narrow a note's tracking to one of its headings.
   *
   * Replaces whatever is already there for that file rather than adding
   * alongside it — `kanban.md` and `kanban.md#Important` in the same list
   * means the unrestricted entry wins and the narrowing silently does
   * nothing, which is worse than refusing.
   */
  async trackSection(file) {
    let content;
    try {
      content = await this.app.vault.read(file);
    } catch (e) {
      new import_obsidian12.Notice(`Smart ToDo: couldn't read ${file.name}.`, 4e3);
      return;
    }
    HeadingScopeModal.open(this.app, file.name, content, async (heading) => {
      if (samePath(file.path, this.primaryFile) && heading) {
        new import_obsidian12.Notice(
          "Smart ToDo: this is the main task file \u2014 new tasks are appended to the end, so it can't be narrowed to one section.",
          6e3
        );
        return;
      }
      const withoutFile = removePathFromScope(
        this.settings.managedFiles,
        file.path,
        this.scopeOptions
      );
      const entry = heading ? `${file.path}#${heading}` : file.path;
      this.settings.managedFiles = addPathToScope(withoutFile, entry);
      await this.saveSettings();
      this.refreshViews();
      const open = (await this.scan()).filter(
        (t) => samePath(t.filePath, file.path) && t.status === "open"
      );
      new import_obsidian12.Notice(
        heading ? `Smart ToDo: tracking only \u201C${heading}\u201D in ${file.name} \u2014 ${open.length} open task${open.length === 1 ? "" : "s"}.` : `Smart ToDo: tracking all of ${file.name} \u2014 ${open.length} open task${open.length === 1 ? "" : "s"}.`,
        6e3
      );
    });
  }
  /**
   * Options shared by every scope call, so a `{{week}}` entry resolves to the
   * same file wherever it's asked about. Threaded explicitly rather than read
   * from a module global: two call sites disagreeing about the week start is
   * exactly the bug that makes track/untrack silently no-op.
   */
  get scopeOptions() {
    var _a2;
    return {
      weekStart: (_a2 = this.settings.weekStart) != null ? _a2 : "sunday",
      expandTokens: this.settings.weekTokensEnabled !== false
    };
  }
  /** The managed scope as currently configured. */
  get scope() {
    return parseScope(this.settings.managedFiles, this.scopeOptions);
  }
  isInManagedScope(path) {
    return isInScope(path, this.scope);
  }
  /** The file new tasks are appended to — and where Keep moves a capture. */
  get primaryFile() {
    return primaryManagedFile(this.scope);
  }
  /**
   * The configured capture file, or null when there's no inbox.
   *
   * `.md` is supplied when it's missing. Obsidian shows note names without the
   * extension everywhere, so typing the path you can see gets you
   * "…/Task inbox" — which matched nothing, left the Inbox bucket silently
   * empty, and looked exactly like the setting hadn't saved.
   */
  get inboxPath() {
    var _a2;
    const raw = (_a2 = this.settings.inboxFile) == null ? void 0 : _a2.trim();
    if (!raw)
      return null;
    return /\.[a-z0-9]+$/i.test(raw) ? raw : `${raw}.md`;
  }
  /**
   * Is this an untriaged capture?
   *
   * Open *and* in the inbox file. A completed line there has already been
   * dealt with, so it rejoins the ordinary list (and shows under Done) rather
   * than sitting in the triage bucket forever.
   */
  isInboxTask(task) {
    return task.status === "open" && samePath(task.filePath, this.inboxPath);
  }
  /** True when an inbox is configured but isn't actually being scanned. */
  get inboxOutOfScope() {
    const path = this.inboxPath;
    return !!path && !this.isInManagedScope(path);
  }
  async scan() {
    var _a2;
    return scanScope(this.app, this.scope, {
      importantHeadings: (_a2 = this.settings.importantHeadings) != null ? _a2 : DEFAULT_IMPORTANT_HEADINGS
    });
  }
  /** Create the managed file if it's missing, so capture always has a target. */
  async ensurePrimaryFile() {
    const path = this.primaryFile;
    if (this.app.vault.getAbstractFileByPath(path))
      return;
    try {
      await ensureManagedFile(this.app, path);
      new import_obsidian12.Notice(`Smart ToDo: created ${path}`, 4e3);
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
      new import_obsidian12.Notice(
        `Smart ToDo: retagged ${applied} of ${changes.length} task${changes.length === 1 ? "" : "s"}.`,
        5e3
      );
      this.refreshViews();
    }).open();
  }
  /**
   * Preview, then apply, the clean slate for one note.
   *
   * The open-line numbers are computed twice on purpose. Once now, from the
   * file on disk, to put an honest count in the dialog; and again inside
   * `archiveOpenTasks`, from the content the write is about to replace, so the
   * lines that move are the lines that are actually there. Reusing the first
   * pass would archive by stale line number — which on a file being edited in
   * another window means moving the wrong lines, silently.
   */
  async openArchiveBacklog(file) {
    const openLinesOf = (content2) => {
      var _a2;
      return parseTasksFromContent(content2, file.path, {
        importantHeadings: (_a2 = this.settings.importantHeadings) != null ? _a2 : DEFAULT_IMPORTANT_HEADINGS
      }).filter((t) => t.status === "open").map((t) => t.lineNumber);
    };
    const content = await this.app.vault.read(file);
    const tasks = parseTasksFromContent(content, file.path).filter(
      (t) => t.status === "open"
    );
    new ArchiveBacklogModal(
      this.app,
      file.path,
      tasks.length,
      tasks.slice(0, 8).map((t) => t.title),
      async () => {
        var _a2;
        let moved = 0;
        const ok = await safeWrite(async () => {
          moved = await archiveOpenTasks(this.app, file.path, openLinesOf);
        });
        if (!ok)
          return;
        new import_obsidian12.Notice(
          moved === 0 ? "Smart ToDo: nothing left to archive." : `Smart ToDo: archived ${moved} task${moved === 1 ? "" : "s"} in ${(_a2 = file.path.split("/").pop()) != null ? _a2 : file.path}.`,
          5e3
        );
        this.refreshViews();
      }
    ).open();
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
  /**
   * Full teardown and redraw, for changes a refresh can't carry: the accent
   * writes CSS custom properties onto the root element at build time, and the
   * mode row's labels are baked into the DOM.
   */
  rebuildViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SMART_TODO)) {
      const view = leaf.view;
      if (view instanceof SmartTodoView)
        view.rebuild();
    }
  }
  /**
   * Run an action against the panel, opening it first if it's closed.
   *
   * Palette and Sweep are both commands, and a command that quietly does
   * nothing because the sidebar happens to be shut is the worst outcome — so
   * these take a beat to reveal the leaf rather than failing silently.
   */
  async withView(fn) {
    await this.activateView();
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_SMART_TODO)[0];
    if (!leaf || !(leaf.view instanceof SmartTodoView))
      return;
    fn(leaf.view);
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
