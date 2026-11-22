// Smart ToDo — task parser.
//
// Pure, obsidian-free parsing lives here (only `import type`, which the
// compiler erases) so the regex layer can be bundled and unit-tested in plain
// node without an Obsidian host. See tests/parser-test.mjs.

import type { App } from "obsidian";
import { isInScope } from "./scope";
import {
  DEFAULT_IMPORTANT_HEADINGS,
  Effort,
  ImportanceSource,
  ManagedScope,
  SmartTask,
  TaskPriority,
} from "./types";

/** Per-line context the whole-file pass knows and a single line cannot. */
export interface TaskLineContext {
  heading?: string | null;
  importantHeadings?: string[];
}

export interface ParseOptions {
  importantHeadings?: string[];
}

/**
 * A markdown task line: optional indent, a list bullet, then `[?]`.
 * Group 1 = indent, group 2 = checkbox char, group 3 = everything after it.
 *
 * The checkbox class is deliberately *any* single character, not `[ xX]`.
 * Obsidian themes define custom statuses — `[/]` in progress, `[-]` cancelled,
 * `[>]` forwarded, `[u]` — and John's week page carries a `- [u] **2025 Taxes**`
 * line. Under the old class that line matched nothing at all: not filtered, not
 * hidden, simply never seen. A task the plugin cannot see is worse than one it
 * sorts wrongly, so unknown markers parse as open and keep their character.
 */
export const TASK_LINE_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[(.)\]\s*(.*)$/;

/**
 * Markers that mean "no longer open". `x`/`X` is done; `-` is the widespread
 * cancelled convention. Everything else — including the themes' in-progress and
 * forwarded markers — is still work in front of you, so it stays open.
 */
const DONE_MARKERS = new Set(["x", "X"]);
const CANCELLED_MARKERS = new Set(["-"]);

/** An ATX heading line: `### Focus this week`. Group 2 = the heading text. */
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

/**
 * Strip the decoration John's vault wraps headings in, so a heading can be
 * compared and displayed as plain words.
 *
 * His week page writes section titles as
 * `##### <mark class="hltr-light-ash">Focus this week, what is Important and
 * Urgent</mark>` — the HTML is a highlight colour, not part of the name.
 */
export function cleanHeading(raw: string): string {
  return displayTitle(
    raw
      .replace(/<[^>]+>/g, "")
      .replace(/^#+\s*/, "")
      .replace(/\s*#+\s*$/, "")
  );
}

/** Tasks-plugin native emoji date fields. */
export const DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;
export const DEFER_RE = /⏳\s*(\d{4}-\d{2}-\d{2})/;
export const DONE_DATE_RE = /✅\s*(\d{4}-\d{2}-\d{2})/;

/** Dataview inline field: `[key:: value]`. Global — a line can carry several. */
export const INLINE_FIELD_RE = /\[([A-Za-z][\w-]*)\s*::\s*([^\]]*)\]/g;

/** Emoji-date tokens, stripped wholesale when deriving the title. */
const EMOJI_DATE_TOKEN_RE = /(?:📅|⏳|✅|🛫|➕|❌)\s*\d{4}-\d{2}-\d{2}/g;

/**
 * A 🔁 recurrence rule is free text ("every week"), not a date, so it needs
 * its own stripper — otherwise the emoji goes and the words stay in the title.
 * Runs to the next token or end of line.
 */
const RECURRENCE_TOKEN_RE = /🔁[^[\]📅⏳✅🛫➕❌🔺⏫🔼🔽⏬]*/gu;

/**
 * The Tasks plugin's `🆔 eb5khv` / `⛔ c17efa` identifiers.
 *
 * Machine addresses for its dependency graph, and meaningless in a sidebar
 * row — but John's week page carries them, so without this the title reads
 * "Email review of Tax docs 🆔 eb5khv". Stripped for display only; the raw
 * line is what gets written back, so the ids survive on disk.
 */
const TASK_ID_TOKEN_RE = /(?:🆔|⛔)\s*[A-Za-z0-9]+(?:\s*,\s*[A-Za-z0-9]+)*/gu;

/**
 * Tasks-plugin priority emoji.
 *
 * The `u` flag is load-bearing: without it this class is read as surrogate
 * *code units* and silently contains the bare lead surrogate `\ud83d`, so it
 * matches the first half of 🔁 (and most other emoji) and leaves mojibake
 * behind in the title.
 */
const PRIORITY_EMOJI_RE = /[🔺⏫🔼🔽⏬]/gu;

/**
 * Priority emoji → the Tasks plugin's five levels.
 *
 * These used to be stripped and thrown away ("not modelled yet"). That was the
 * expensive kind of nothing: the Eisenhower axis depends on a stored
 * `[important:: true]` that almost no line carries, so nearly everything landed
 * in *unjudged* — while the week page was already marked up ⏫ and 🔼 by hand.
 * The judgment existed; the plugin just wasn't reading it.
 */
const PRIORITY_BY_EMOJI: Record<string, TaskPriority> = {
  "🔺": "highest",
  "⏫": "high",
  "🔼": "medium",
  "🔽": "low",
  "⏬": "lowest",
};

/** First priority emoji on the line, or null. */
export function parsePriority(body: string): TaskPriority | null {
  const m = new RegExp(PRIORITY_EMOJI_RE.source, "u").exec(body);
  return m ? PRIORITY_BY_EMOJI[m[0]] ?? null : null;
}

/**
 * Does a priority imply the Eisenhower "important" axis?
 *
 * Medium and up means it matters; low and lowest are an explicit *not* this.
 * Deliberately not a silent default for unmarked lines — absent priority stays
 * unjudged, because "he didn't say" and "he said no" must not collapse.
 */
export function importanceFromPriority(p: TaskPriority | null): boolean | null {
  if (p === "highest" || p === "high" || p === "medium") return true;
  if (p === "low" || p === "lowest") return false;
  return null;
}

/**
 * Does the heading above a task declare its whole subtree important?
 *
 * The week page's `##### Focus this week, what is Important and Urgent` is not
 * decoration — it is the judgment, written once for a list instead of once per
 * line. Matching is substring, case-insensitive, against the cleaned heading.
 */
export function headingImpliesImportant(
  heading: string | null,
  needles: string[] = DEFAULT_IMPORTANT_HEADINGS
): boolean {
  if (!heading) return false;
  const h = heading.toLowerCase();
  return needles.some((n) => n.trim().length > 0 && h.includes(n.trim().toLowerCase()));
}

/**
 * Parse `YYYY-MM-DD` as *local* midnight.
 *
 * `new Date("2026-11-04")` parses as UTC midnight, which in EST renders as
 * Nov 3 — every date would read one day early. Explicit Y/M/D avoids that.
 */
export function parseDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  // Reject impossible dates (e.g. 2026-02-31 rolling into March).
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** Inverse of parseDate — local-date safe `YYYY-MM-DD`. */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function normalizeEffort(value: string): Effort | null {
  const v = value.trim().toLowerCase();
  if (v === "light" || v === "moderate" || v === "heavy" || v === "deep") return v;
  return null;
}

/**
 * Parse the stored Eisenhower "important" judgment.
 * `true/yes/1/high` → true, `false/no/0/low` → false, anything else → null
 * (unjudged). Unjudged is a first-class state: it's the review queue.
 */
function normalizeImportant(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "yes" || v === "1" || v === "high") return true;
  if (v === "false" || v === "no" || v === "0" || v === "low") return false;
  return null;
}

/** Collect every `[key:: value]` on a line, lowercased keys. */
export function extractInlineFields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Fresh regex per call — a shared /g regex carries lastIndex between calls.
  const re = new RegExp(INLINE_FIELD_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

/** Strip all machine-readable tokens, leaving the human-readable title. */
export function deriveTitle(body: string): string {
  return body
    .replace(new RegExp(INLINE_FIELD_RE.source, "g"), "")
    .replace(EMOJI_DATE_TOKEN_RE, "")
    .replace(RECURRENCE_TOKEN_RE, "")
    .replace(TASK_ID_TOKEN_RE, "")
    .replace(PRIORITY_EMOJI_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The title as it should *read* in a narrow panel.
 *
 * Display only — `title` keeps the original text, and nothing written back to
 * disk goes through this. Tracked project notes are the reason: prose notes
 * use bold, links and wikilinks freely, so a shopping list row arrives as
 * `**Propane — full 20 lb tank** (none visible in photos; fill now)` and
 * renders with the asterisks showing. Markers are unwrapped rather than
 * deleted, so no words are lost.
 */
export function displayTitle(title: string): string {
  return title
    .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2") // [[path|alias]] → alias
    .replace(/!?\[\[([^\]]+)\]\]/g, "$1") // [[page]] → page
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse one line into a SmartTask, or null if the line isn't a task.
 * `filePath` / `lineNumber` are passed through for write-back addressing.
 */
export function parseTaskLine(
  line: string,
  filePath: string,
  lineNumber: number,
  context: TaskLineContext = {}
): SmartTask | null {
  const m = TASK_LINE_RE.exec(line);
  if (!m) return null;

  const indentRaw = m[1];
  const checkbox = m[2];
  const body = m[3];
  const fields = extractInlineFields(body);

  const dueMatch = DUE_RE.exec(body);
  const deferMatch = DEFER_RE.exec(body);
  const doneMatch = DONE_DATE_RE.exec(body);

  const pushesRaw = fields["pushes"];
  const pushesParsed = pushesRaw === undefined ? NaN : parseInt(pushesRaw, 10);

  const priority = parsePriority(body);
  const heading = context.heading ?? null;

  // Importance resolution, most specific first. An explicit `[important::]`
  // always wins — it's the one the user typed *at* this task, and the only one
  // the panel itself writes. Then the line's own priority emoji. Then the
  // heading it sits under, which is a judgment about a whole list.
  //
  // Where it came from is kept, not just the verdict: importance moves a task
  // between quadrants, and a panel that silently reclassifies your work is one
  // you stop trusting. The row can show its reason.
  let important: boolean | null = null;
  let importantFrom: ImportanceSource = null;
  if (fields["important"] !== undefined) {
    important = normalizeImportant(fields["important"]);
    if (important !== null) importantFrom = "field";
  }
  if (important === null && priority !== null) {
    important = importanceFromPriority(priority);
    if (important !== null) importantFrom = "priority";
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
    due: dueMatch ? parseDate(dueMatch[1]) : null,
    defer: deferMatch ? parseDate(deferMatch[1]) : null,
    doneDate: doneMatch ? parseDate(doneMatch[1]) : null,
    dropped: fields["dropped"] ? parseDate(fields["dropped"]) : null,
    effort: fields["effort"] ? normalizeEffort(fields["effort"]) : null,
    pushes: Number.isFinite(pushesParsed) && pushesParsed > 0 ? pushesParsed : 0,
    project: fields["project"] || null,
    assigned: fields["assigned"] || null,
    important,
  };
}

/**
 * Parse every task line out of one file's contents.
 *
 * Two things only a whole-file pass can know, and both matter on a page that
 * was written for a human rather than for this plugin:
 *
 * **The heading above.** A project note's checkboxes come in sections, and the
 * section is most of the meaning — "Fund 4.0 Prep" and "2025 Taxes" are not one
 * undifferentiated list of eleven errands.
 *
 * **The parent task.** `- [ ] Fund 4 build to 30M` with two indented children
 * is a project, not a thing you do; flattened into peers it reads as three
 * unrelated jobs, which is the same complaint as ten loose turkey errands, one
 * level down.
 */
export function parseTasksFromContent(
  content: string,
  filePath: string,
  options: ParseOptions = {}
): SmartTask[] {
  const tasks: SmartTask[] = [];
  const lines = content.split("\n");
  let heading: string | null = null;
  // Open task lines by indent depth, nearest ancestor last.
  const ancestry: SmartTask[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // A ```base / ```tasks block can hold `- [ ]`-looking text; John's week
    // page ends in one. Code fences are not task lists.
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      heading = cleanHeading(headingMatch[2]) || null;
      ancestry.length = 0; // a heading ends any list above it
      continue;
    }

    const task = parseTaskLine(lines[i], filePath, i, {
      heading,
      importantHeadings: options.importantHeadings,
    });
    if (!task) continue;

    while (ancestry.length > 0 && ancestry[ancestry.length - 1].indent >= task.indent) {
      ancestry.pop();
    }
    const parent = ancestry[ancestry.length - 1];
    if (parent) {
      task.parentLine = parent.lineNumber;
      // Importance flows downhill: a sub-task of important work is important,
      // unless it says otherwise itself.
      if (task.important === null && parent.important !== null) {
        task.important = parent.important;
        task.importantFrom = "parent";
      }
    }
    ancestry.push(task);
    tasks.push(task);
  }

  // Parent and child always live in the same file, so the counts are final
  // here — no caller has to remember a second pass to get them.
  return markParents(tasks);
}

/**
 * Mark every task that has at least one open child.
 *
 * A parent with open children is a container — you don't "do" *Fund 4 build to
 * 30M*, you do the two things under it — so it shouldn't compete for a slot in
 * Do First or be swept as a three-minute job.
 */
export function markParents(tasks: SmartTask[]): SmartTask[] {
  const openChildren = new Map<string, number>();
  for (const t of tasks) {
    if (t.parentLine === null || t.status !== "open") continue;
    const key = `${t.filePath}:${t.parentLine}`;
    openChildren.set(key, (openChildren.get(key) ?? 0) + 1);
  }
  for (const t of tasks) {
    t.openChildren = openChildren.get(`${t.filePath}:${t.lineNumber}`) ?? 0;
  }
  return tasks;
}

/**
 * Scan the managed scope only — never the whole vault.
 *
 * Reads go through `vault.read`, not `cachedRead`. `cachedRead` returns the
 * last-indexed copy, which lags a write by a tick — that's what made a
 * just-captured task land in the file but miss the next repaint, so it only
 * showed up on a later refresh. Scope is a handful of files by construction,
 * so the uncached read costs nothing and the panel is never behind the file.
 */
export async function scanScope(
  app: App,
  scope: ManagedScope,
  options: ParseOptions = {}
): Promise<SmartTask[]> {
  const files = app.vault
    .getMarkdownFiles()
    .filter((file) => isInScope(file.path, scope));
  const all: SmartTask[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = await app.vault.read(file);
    } catch (e) {
      continue; // unreadable file shouldn't sink the whole scan
    }
    // Cheap pre-filter: any list bullet followed by a one-character checkbox.
    // Testing for `[ ]`/`[x]` specifically would skip a file whose tasks all
    // use a theme marker — which is the bug this release exists to fix.
    if (!/^\s*(?:[-*+]|\d+[.)])\s+\[.\]/m.test(content)) continue;
    all.push(...parseTasksFromContent(content, file.path, options));
  }
  return all;
}
