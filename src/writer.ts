// Smart ToDo — write-back layer.
//
// Rule: never rewrite a file wholesale. Every mutation replaces exactly one
// line, and only after confirming that line still holds the text we parsed.
// The view can be seconds stale (user edited the note, Sync landed a change),
// and silently clobbering someone's note is the one unforgivable bug here.

import { App, Notice, TFile } from "obsidian";
import { Effort, SmartTask } from "./types";
import {
  DEFER_RE,
  DONE_DATE_RE,
  DUE_RE,
  addDays,
  formatDate,
  parseDate,
  startOfToday,
} from "./parser";

export class StaleTaskError extends Error {}

function getFile(app: App, path: string): TFile {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    throw new StaleTaskError(`File no longer exists: ${path}`);
  }
  return file;
}

/**
 * Replace the single line `task` came from with `newLine`.
 *
 * Matching is by (path, lineNumber, exact rawText). If the line moved — a
 * paragraph was inserted above it — we fall back to a whole-file search, but
 * only accept a *unique* match; two identical task lines are ambiguous and we
 * refuse rather than guess.
 *
 * Uses `vault.process` (read-modify-write under Obsidian's own file lock,
 * 1.6+) so a concurrent edit can't interleave.
 */
export async function replaceTaskLine(
  app: App,
  task: SmartTask,
  newLine: string
): Promise<void> {
  const file = getFile(app, task.filePath);

  const mutate = (content: string): string => {
    const lines = content.split("\n");

    let index = task.lineNumber;
    if (lines[index] !== task.rawText) {
      const matches: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === task.rawText) matches.push(i);
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

  const vault = app.vault as any;
  if (typeof vault.process === "function") {
    await vault.process(file, mutate);
  } else {
    // Pre-1.6 fallback. Same safety check, just without the file lock.
    const content = await app.vault.read(file);
    await app.vault.modify(file, mutate(content));
  }
}

/** Set or replace an inline `[key:: value]` field, appending if absent. */
export function setInlineField(line: string, key: string, value: string): string {
  const re = new RegExp(`\\[${key}\\s*::\\s*[^\\]]*\\]`, "i");
  if (re.test(line)) {
    return line.replace(re, `[${key}:: ${value}]`);
  }
  return `${line.replace(/\s+$/, "")} [${key}:: ${value}]`;
}

export function removeInlineField(line: string, key: string): string {
  const re = new RegExp(`\\s*\\[${key}\\s*::\\s*[^\\]]*\\]`, "i");
  return line.replace(re, "");
}

/** Set or replace an emoji-dated field, appending if absent. */
function setEmojiDate(line: string, emoji: string, re: RegExp, date: Date): string {
  const token = `${emoji} ${formatDate(date)}`;
  if (re.test(line)) {
    return line.replace(re, token);
  }
  return `${line.replace(/\s+$/, "")} ${token}`;
}

function removeEmojiDate(line: string, re: RegExp): string {
  return line.replace(new RegExp(`\\s*${re.source}`), "");
}

/** Flip `- [ ]` ⇄ `- [x]` while preserving indent and bullet style. */
function setCheckbox(line: string, done: boolean): string {
  return line.replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+\[)[ xX](\])/,
    `$1${done ? "x" : " "}$2`
  );
}

/**
 * Toggle completion. Completing stamps `✅ <today>`; un-completing strips it,
 * so a mis-click leaves no residue.
 */
export function buildToggledLine(task: SmartTask, nowDone: boolean): string {
  let line = setCheckbox(task.rawText, nowDone);
  if (nowDone) {
    line = setEmojiDate(line, "✅", DONE_DATE_RE, startOfToday());
  } else {
    line = removeEmojiDate(line, DONE_DATE_RE);
  }
  return line;
}

export async function toggleTaskDone(
  app: App,
  task: SmartTask,
  nowDone: boolean
): Promise<void> {
  await replaceTaskLine(app, task, buildToggledLine(task, nowDone));
}

/**
 * Push a task out by `days`.
 *
 * Target field is due, falling back to defer when there's no due date. A task
 * with neither gets a due date of today + days — pushing an undated backlog
 * item is an implicit "I'm deciding when this lands".
 */
export function buildPushedLine(task: SmartTask, days = 1): string {
  let line = task.rawText;

  if (task.due) {
    line = setEmojiDate(line, "📅", DUE_RE, addDays(task.due, days));
  } else if (task.defer) {
    line = setEmojiDate(line, "⏳", DEFER_RE, addDays(task.defer, days));
  } else {
    line = setEmojiDate(line, "📅", DUE_RE, addDays(startOfToday(), days));
  }

  line = setInlineField(line, "pushes", String(task.pushes + 1));
  return line;
}

export async function pushTask(app: App, task: SmartTask, days = 1): Promise<void> {
  await replaceTaskLine(app, task, buildPushedLine(task, days));
}

export function buildEffortLine(task: SmartTask, effort: Effort | null): string {
  return effort === null
    ? removeInlineField(task.rawText, "effort")
    : setInlineField(task.rawText, "effort", effort);
}

export async function setTaskEffort(
  app: App,
  task: SmartTask,
  effort: Effort | null
): Promise<void> {
  await replaceTaskLine(app, task, buildEffortLine(task, effort));
}

export function buildProjectLine(task: SmartTask, project: string | null): string {
  const trimmed = project?.trim();
  return !trimmed
    ? removeInlineField(task.rawText, "project")
    : setInlineField(task.rawText, "project", trimmed);
}

export async function setTaskProject(
  app: App,
  task: SmartTask,
  project: string | null
): Promise<void> {
  await replaceTaskLine(app, task, buildProjectLine(task, project));
}

// --- Task capture --------------------------------------------------------

/** Default body for an auto-created managed file. */
export const MANAGED_FILE_STUB = "# Tasks\n\n";

/**
 * Append a new `- [ ] <title>` line to `content`.
 *
 * Runs of trailing blank lines collapse to at most one, so repeated captures
 * stack tidily instead of drifting down the file — while a single blank
 * separator is preserved, which keeps a `# Tasks` header from ending up
 * crammed against the first item. The result always ends in a newline.
 *
 * Only the title is written. Due/defer/effort get set afterwards from the row
 * UI, so capture stays a single keystroke.
 */
export function buildAppendedContent(content: string, title: string): string {
  const line = `- [ ] ${title.trim()}`;
  const lines = content.split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return `${line}\n`;
  if (/\n[ \t]*\n[ \t\r\n]*$/.test(content)) lines.push("");
  lines.push(line);
  return `${lines.join("\n")}\n`;
}

/** Create the managed file (and any missing parent folders) if absent. */
export async function ensureManagedFile(app: App, path: string): Promise<TFile> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  const slash = path.lastIndexOf("/");
  if (slash > 0) {
    const folder = path.slice(0, slash);
    if (!app.vault.getAbstractFileByPath(folder)) {
      try {
        await app.vault.createFolder(folder);
      } catch (e) {
        // Benign race: another handler created it between check and create.
      }
    }
  }
  return app.vault.create(path, MANAGED_FILE_STUB);
}

/** Capture a task into the managed file, creating that file if needed. */
export async function appendTask(
  app: App,
  path: string,
  title: string
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new StaleTaskError("Task title is empty.");

  const file = await ensureManagedFile(app, path);
  const vault = app.vault as any;
  if (typeof vault.process === "function") {
    await vault.process(file, (content: string) =>
      buildAppendedContent(content, trimmed)
    );
  } else {
    const content = await app.vault.read(file);
    await app.vault.modify(file, buildAppendedContent(content, trimmed));
  }
}

/** Surface write failures instead of swallowing them into a silent no-op. */
export async function safeWrite(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    new Notice(`Smart ToDo: ${msg}`, 6000);
    console.error("[smart-todo] write failed", e);
    return false;
  }
}

// Re-exported for the test harness, which exercises date math via the writer.
export { parseDate, formatDate, addDays, startOfToday };
