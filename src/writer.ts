// Smart ToDo — write-back layer.
//
// Rule: never rewrite a file wholesale. Every mutation replaces exactly one
// line, and only after confirming that line still holds the text we parsed.
// The view can be seconds stale (user edited the note, Sync landed a change),
// and silently clobbering someone's note is the one unforgivable bug here.

import { App, Notice, TFile } from "obsidian";
import { Effort, SmartTask } from "./types";
import { samePath } from "./scope";
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
 * Read-modify-write one file under Obsidian's own lock.
 *
 * `vault.process` (1.6+) holds the file lock across the read and the write, so
 * a concurrent edit can't interleave. The fallback keeps older hosts working
 * with the same mutation function — just without the lock.
 */
async function processFile(
  app: App,
  file: TFile,
  mutate: (content: string) => string
): Promise<void> {
  const vault = app.vault as any;
  if (typeof vault.process === "function") {
    await vault.process(file, mutate);
  } else {
    const content = await app.vault.read(file);
    await app.vault.modify(file, mutate(content));
  }
}

/**
 * Find the line `task` was parsed from inside `lines`, or throw.
 *
 * Matching is by (lineNumber, exact rawText). If the line moved — a paragraph
 * was inserted above it — fall back to a whole-file search, but only accept a
 * *unique* match; two identical task lines are ambiguous and we refuse rather
 * than guess. Shared by every mutation so replace, move and delete all hold
 * the same standard of proof before touching a file.
 */
export function locateTaskLine(lines: string[], task: SmartTask): number {
  if (lines[task.lineNumber] === task.rawText) return task.lineNumber;

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
  return matches[0];
}

/**
 * Replace the single line `task` came from with `newLine`.
 *
 * Never rewrites more than that one line: every other line is passed through
 * in order, so a stale view can't clobber an edit made elsewhere in the file.
 */
export async function replaceTaskLine(
  app: App,
  task: SmartTask,
  newLine: string
): Promise<void> {
  const file = getFile(app, task.filePath);
  await processFile(app, file, (content) => {
    const lines = content.split("\n");
    lines[locateTaskLine(lines, task)] = newLine;
    return lines.join("\n");
  });
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

/**
 * Flip `- [ ]` ⇄ `- [x]` while preserving indent and bullet style.
 *
 * The character class is any single char, matching the parser. It used to be
 * `[ xX]`, which meant a theme-status line like `- [u] 2025 Taxes` — now
 * visible in the panel — would have silently refused to tick: the replace
 * found nothing, the line came back identical, and `processFile` treats an
 * unchanged line as "nothing to do". A checkbox that does nothing when clicked
 * is worse than one that was never shown.
 */
function setCheckbox(line: string, done: boolean): string {
  return line.replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+\[).(\])/,
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
 * Two rules, both learned from a push that visibly did nothing:
 *
 * - **Push from today, never from a stale date.** Adding a day to a due date
 *   that's 26 days in the past leaves the task 25 days late: still overdue,
 *   still urgent, still sitting at the top of Do First with nothing but the ↻
 *   counter to show for the click. The only reading of "push by a day" that
 *   means anything on an overdue task is "land it tomorrow".
 * - **A push rests the task until the new date.** Urgency is derived from the
 *   due date and can't be stored, so the defer field is the one honest lever
 *   for "not today": a resting task is never urgent, which moves it out of Do
 *   First into Schedule, and it comes back on its own when the date arrives.
 *
 * Target field is due, falling back to defer when there's no due date — pushing
 * a deferred-but-undated task shouldn't invent a deadline for it. A task with
 * neither gets both, which is the implicit "I'm deciding when this lands".
 */
export function pushTargetDate(task: SmartTask, days = 1, today = startOfToday()): Date {
  const anchor = task.due ?? task.defer;
  // Never push backwards in time: a date already in the past restarts today.
  const from = anchor && anchor.getTime() > today.getTime() ? anchor : today;
  return addDays(from, days);
}

export function buildPushedLine(task: SmartTask, days = 1): string {
  const today = startOfToday();
  const target = pushTargetDate(task, days, today);
  let line = task.rawText;

  if (task.due || !task.defer) {
    line = setEmojiDate(line, "📅", DUE_RE, target);
  }
  line = setEmojiDate(line, "⏳", DEFER_RE, target);

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

/**
 * Set the Eisenhower "important" judgment. `true`/`false` write an explicit
 * `[important:: true|false]`; `null` clears the field (back to unjudged).
 * Urgency is never written — it's always derived from the due date.
 */
export function buildImportantLine(
  task: SmartTask,
  important: boolean | null
): string {
  return important === null
    ? removeInlineField(task.rawText, "important")
    : setInlineField(task.rawText, "important", important ? "true" : "false");
}

export async function setTaskImportant(
  app: App,
  task: SmartTask,
  important: boolean | null
): Promise<void> {
  await replaceTaskLine(app, task, buildImportantLine(task, important));
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

// --- Full-task edit ------------------------------------------------------
//
// Everything above mutates one field. The editor modal needs to change several
// at once — including the title, which the single-field helpers can't touch
// because the title isn't a delimited token, it's "whatever text is left".

/** Indent + bullet + checkbox, i.e. everything before the task body. */
const LINE_PREFIX_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[.\]\s*)/;

/** The emoji that introduce a dated field, per the Tasks plugin convention. */
const DATE_EMOJI = "📅⏳✅🛫➕❌";
/** Tasks-plugin priority emoji, which stand alone with no value after them. */
const PRIORITY_EMOJI = "🔺⏫🔼🔽⏬";

/**
 * Every machine-readable token a task line can carry: inline fields, emoji
 * dates, a 🔁 recurrence rule, and priority emoji. Used to lift the tokens off
 * a line so the prose title can be swapped without disturbing them.
 *
 * Two things this has to get right:
 *
 * - The `u` flag is load-bearing. Without it a character class of emoji is
 *   read as surrogate *code units*, so `[🔺🔼🔽]` quietly contains the bare
 *   lead surrogate `\ud83d` and matches the first half of any other emoji on
 *   the line — lifting a broken half-character out of 🔁 and leaving mojibake
 *   in the file.
 * - Recurrence is free text (`🔁 every week`), not a date, so it gets its own
 *   alternative that runs to the next token rather than expecting `YYYY-MM-DD`.
 */
const TOKEN_RE = new RegExp(
  [
    // [key:: value]
    String.raw`\[[A-Za-z][\w-]*\s*::\s*[^\]]*\]`,
    // 🔁 every week  (free text, stops at the next token or end of line)
    `🔁[^\\[\\]${DATE_EMOJI}${PRIORITY_EMOJI}]*`,
    // 📅 2026-11-20
    `[${DATE_EMOJI}]\\s*\\d{4}-\\d{2}-\\d{2}`,
    // ⏫
    `[${PRIORITY_EMOJI}]`,
  ].join("|"),
  "gu"
);

/**
 * Replace the prose title, leaving every token intact and in its original
 * order. The alternative — rebuilding the line from parsed fields — would
 * silently drop anything the parser doesn't model yet (🔁 recurrence, a
 * hand-written `[context:: …]`), so this lifts tokens rather than regenerating
 * them.
 */
export function buildRetitledLine(task: SmartTask, title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new StaleTaskError("Task title can't be empty.");

  const prefixMatch = LINE_PREFIX_RE.exec(task.rawText);
  if (!prefixMatch) throw new StaleTaskError("Not a task line; refusing to rewrite.");
  const prefix = prefixMatch[1];
  const body = task.rawText.slice(prefix.length);

  // Trim each token: the recurrence alternative is greedy up to the next
  // token, so it carries the separating space along with it.
  const tokens = (body.match(TOKEN_RE) ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return [prefix + trimmed, ...tokens].join(" ").replace(/\s+$/, "");
}

export interface TaskPatch {
  title?: string;
  due?: Date | null;
  defer?: Date | null;
  effort?: Effort | null;
  important?: boolean | null;
  project?: string | null;
  pushes?: number;
}

/**
 * Compose one new line from any subset of fields. Applied in a fixed order so
 * the result is deterministic: title first (it reorders nothing), then dates,
 * then inline fields. Omitted keys are left exactly as they were — this is a
 * patch, not a replace, so a field the modal doesn't show can't be erased.
 */
export function buildPatchedLine(task: SmartTask, patch: TaskPatch): string {
  let line = task.rawText;

  if (patch.title !== undefined) {
    line = buildRetitledLine(task, patch.title);
  }

  if (patch.due !== undefined) {
    line =
      patch.due === null
        ? removeEmojiDate(line, DUE_RE)
        : setEmojiDate(line, "📅", DUE_RE, patch.due);
  }

  if (patch.defer !== undefined) {
    line =
      patch.defer === null
        ? removeEmojiDate(line, DEFER_RE)
        : setEmojiDate(line, "⏳", DEFER_RE, patch.defer);
  }

  if (patch.effort !== undefined) {
    line =
      patch.effort === null
        ? removeInlineField(line, "effort")
        : setInlineField(line, "effort", patch.effort);
  }

  if (patch.project !== undefined) {
    const trimmed = patch.project?.trim();
    line = !trimmed
      ? removeInlineField(line, "project")
      : setInlineField(line, "project", trimmed);
  }

  if (patch.important !== undefined) {
    line =
      patch.important === null
        ? removeInlineField(line, "important")
        : setInlineField(line, "important", patch.important ? "true" : "false");
  }

  if (patch.pushes !== undefined) {
    line =
      patch.pushes <= 0
        ? removeInlineField(line, "pushes")
        : setInlineField(line, "pushes", String(patch.pushes));
  }

  return line.replace(/\s+$/, "");
}

export async function applyTaskPatch(
  app: App,
  task: SmartTask,
  patch: TaskPatch
): Promise<void> {
  const next = buildPatchedLine(task, patch);
  if (next === task.rawText) return; // nothing changed; don't touch the file
  await replaceTaskLine(app, task, next);
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
  return appendRawLine(content, `- [ ] ${title.trim()}`);
}

/** The blank-line-tidying append, for a line that's already fully formed. */
function appendRawLine(content: string, line: string): string {
  const lines = content.split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return `${line}\n`;
  if (/\n[ \t]*\n[ \t\r\n]*$/.test(content)) lines.push("");
  lines.push(line);
  return `${lines.join("\n")}\n`;
}

/**
 * A heading that claims triaged items. Adding `## Kept` (or Triaged, or Inbox)
 * anywhere in the file is how you say "put them here" without a setting for
 * it; if the file has none, the first Keep writes one. See buildKeptContent.
 */
const TRIAGE_HEADING_RE = /^(#{1,6})\s+(?:kept|triaged|inbox)\b/i;

/**
 * Where a line should be inserted in `lines`, or -1 for "append to the end".
 *
 * Two cases earn the complexity:
 *
 * - A `## Kept` heading means the file has already been told where triaged
 *   work goes; the line joins the end of that section.
 * - A fenced block — John put a ```tasks query at the foot of the inbox — must
 *   never be written past. A blind append puts the task *inside* a code block
 *   in reading view, where it still parses but is invisible and unclickable.
 *   The Stream ingest script hit exactly this and solves it the same way.
 */
export function insertIndexFor(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const heading = TRIAGE_HEADING_RE.exec(lines[i]);
    if (!heading) continue;
    const level = heading[1].length;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const next = /^(#{1,6})\s/.exec(lines[j]);
      if (next && next[1].length <= level) {
        end = j;
        break;
      }
    }
    // Back up over the blank line(s) before the next heading so the task joins
    // the section rather than floating in the gap below it.
    while (end > i + 1 && lines[end - 1].trim() === "") end--;
    return end;
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("```")) {
      let j = i;
      while (j > 0 && lines[j - 1].trim() === "") j--;
      return j;
    }
  }

  return -1;
}

/** Insert an already-formed task line at the right place in `content`. */
export function buildInsertedContent(content: string, line: string): string {
  const lines = content.split("\n");
  const at = insertIndexFor(lines);
  if (at < 0) return appendRawLine(content, line);
  lines.splice(at, 0, line);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

/**
 * Insert a *kept* line — one promoted out of the inbox — into `content`.
 *
 * Same placement rules as buildInsertedContent, with one addition: if the file
 * has no triage heading at all, write one. Without it a kept task appends to
 * the foot of the file, which in a tracker that ends in `### Later` (an
 * OmniFocus import section) files it under a heading that lies about it. One
 * `## Kept` heading, created once, makes the destination honest and is then
 * found by every later Keep.
 */
export function buildKeptContent(content: string, line: string): string {
  const lines = content.split("\n");
  if (lines.some((l) => TRIAGE_HEADING_RE.test(l))) {
    return buildInsertedContent(content, line);
  }

  if (insertIndexFor(lines) < 0) {
    const sep = content.trim() ? "\n" : "";
    return appendRawLine(content, `${sep}## Kept\n\n${line}`);
  }

  const at = insertIndexFor(lines);
  const block = ["## Kept", "", line, ""];
  if (at > 0 && lines[at - 1].trim() !== "") block.unshift("");
  lines.splice(at, 0, ...block);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
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
  await processFile(app, file, (content) =>
    buildInsertedContent(content, `- [ ] ${trimmed}`)
  );
}

// --- Triage: keep and drop -----------------------------------------------
//
// The two verbs the Inbox bucket needs. Keep promotes a capture into the
// working list; Drop lets it go. Both are deliberately *not* deletions: the
// Stream id on the line is what stops the ingest bridge re-creating the task
// fifteen minutes later, so a dropped item has to stay on disk, visibly dead,
// rather than vanish and come straight back.

/**
 * Move a task's line out of its file and into `targetPath`.
 *
 * Insert first, remove second. That ordering is chosen for its failure mode:
 * if the second write fails the task exists in both files — visible, obvious,
 * and fixable by hand — whereas removing first would risk losing the line
 * outright. The source line is verified *before* either write, so the common
 * stale case fails with nothing written at all.
 *
 * The whole line moves verbatim, inline fields included. That matters beyond
 * tidiness: `[stream:: <uuid>]` is the ingest bridge's dedupe key, and it
 * searches both files, so a kept task stays ingested forever.
 */
export async function moveTaskLine(
  app: App,
  task: SmartTask,
  targetPath: string
): Promise<void> {
  if (samePath(task.filePath, targetPath)) return; // already where it's going

  const source = getFile(app, task.filePath);
  const content = await app.vault.read(source);
  locateTaskLine(content.split("\n"), task); // throws before anything is written

  const target = await ensureManagedFile(app, targetPath);
  await processFile(app, target, (c) => buildKeptContent(c, task.rawText));

  try {
    await processFile(app, source, (c) => {
      const lines = c.split("\n");
      lines.splice(locateTaskLine(lines, task), 1);
      return lines.join("\n");
    });
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new StaleTaskError(
      `Copied into ${targetPath}, but couldn't remove it from ${task.filePath} — ` +
        `it's now in both files. Delete one by hand. (${why})`
    );
  }
}

/**
 * Mark a capture as let go, in place.
 *
 * Written as a completed line plus `[dropped:: <date>]` rather than deleted,
 * for two reasons: the `[stream:: …]` id has to survive or the bridge re-adds
 * the task on its next pass, and a dropped decision you can see (and undo by
 * unticking the box) beats one that silently removed a line from a note.
 */
export function buildDroppedLine(task: SmartTask): string {
  return setInlineField(
    buildToggledLine(task, true),
    "dropped",
    formatDate(startOfToday())
  );
}

export async function dropTask(app: App, task: SmartTask): Promise<void> {
  await replaceTaskLine(app, task, buildDroppedLine(task));
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
