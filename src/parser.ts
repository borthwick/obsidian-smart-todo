// Smart ToDo — task parser.
//
// Pure, obsidian-free parsing lives here (only `import type`, which the
// compiler erases) so the regex layer can be bundled and unit-tested in plain
// node without an Obsidian host. See tests/parser-test.mjs.

import type { App } from "obsidian";
import { isInScope } from "./scope";
import { Effort, ManagedScope, SmartTask } from "./types";

/**
 * A markdown task line: optional indent, a list bullet, then `[ ]` / `[x]`.
 * Group 1 = checkbox char, group 2 = everything after the checkbox.
 */
export const TASK_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s*(.*)$/;

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
 * Tasks-plugin priority emoji — not modelled yet, but shouldn't pollute titles.
 *
 * The `u` flag is load-bearing: without it this class is read as surrogate
 * *code units* and silently contains the bare lead surrogate `\ud83d`, so it
 * matches the first half of 🔁 (and most other emoji) and leaves mojibake
 * behind in the title.
 */
const PRIORITY_EMOJI_RE = /[🔺⏫🔼🔽⏬]/gu;

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
    .replace(PRIORITY_EMOJI_RE, "")
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
  lineNumber: number
): SmartTask | null {
  const m = TASK_LINE_RE.exec(line);
  if (!m) return null;

  const checkbox = m[1];
  const body = m[2];
  const fields = extractInlineFields(body);

  const dueMatch = DUE_RE.exec(body);
  const deferMatch = DEFER_RE.exec(body);
  const doneMatch = DONE_DATE_RE.exec(body);

  const pushesRaw = fields["pushes"];
  const pushesParsed = pushesRaw === undefined ? NaN : parseInt(pushesRaw, 10);

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
    important:
      fields["important"] !== undefined
        ? normalizeImportant(fields["important"])
        : null,
  };
}

/** Parse every task line out of one file's contents. */
export function parseTasksFromContent(content: string, filePath: string): SmartTask[] {
  const tasks: SmartTask[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i], filePath, i);
    if (task) tasks.push(task);
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
export async function scanScope(app: App, scope: ManagedScope): Promise<SmartTask[]> {
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
    // Cheap pre-filter: skip files with no checkbox at all.
    if (content.indexOf("[ ]") === -1 && !/\[[xX]\]/.test(content)) continue;
    all.push(...parseTasksFromContent(content, file.path));
  }
  return all;
}
