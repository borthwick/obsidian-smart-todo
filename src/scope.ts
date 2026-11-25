// Smart ToDo — managed scope resolution.
//
// Pure (no obsidian imports) so scope filtering is unit-testable in plain node
// alongside the parser. See tests/parser-test.mjs.

import {
  DEFAULT_MANAGED_FILE,
  ManagedScope,
  ScopeEntry,
  SmartTask,
} from "./types";

// --- Calendar tokens in scope paths --------------------------------------
//
// One note in the scope has a path that moves: the weekly page. Everything
// else is tracked once and stays put, but `Week 48 of 2026.md` becomes a
// different file every Monday. Tracking it by hand means re-tracking weekly
// and remembering to drop the old one — and the failure when you forget is
// silent and bad: the panel keeps showing last week's priorities as though
// they were this week's.

/**
 * Week number for a date, under a Sunday- or Monday-start convention.
 *
 * Monday-start is ISO-8601 (week 1 contains the first Thursday). Sunday-start
 * is the US convention: week 1 is the week containing Jan 1.
 *
 * The default is Sunday because that's what John's vault does — the page he
 * wrote on Sunday 22 Nov 2026 for the week ahead is `Week 48 of 2026`, where
 * ISO-8601 calls that date week 47. Getting this wrong points the panel at an
 * adjacent week's page, which looks like the feature simply not working.
 */
export function weekNumber(date: Date, weekStart: "sunday" | "monday" = "sunday"): number {
  if (weekStart === "monday") {
    // ISO-8601: shift to the Thursday of this week, then count weeks from the
    // first Thursday of that Thursday's year.
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
    d.setDate(d.getDate() - dow + 3);
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const fdow = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - fdow + 3);
    return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  }
  // Sunday-start: how many Sunday boundaries since the Sunday on or before Jan 1.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekOneStart = new Date(jan1);
  weekOneStart.setDate(jan1.getDate() - jan1.getDay());
  return 1 + Math.floor((d.getTime() - weekOneStart.getTime()) / (7 * 86400000));
}

/**
 * The calendar year a week number belongs to.
 *
 * In ISO-8601 the last days of December can fall in week 1 of the next year
 * (and vice versa), so `{{year}}` has to agree with `{{week}}` or the pattern
 * resolves to a file that doesn't exist for a few days each January.
 */
export function weekYear(date: Date, weekStart: "sunday" | "monday" = "sunday"): number {
  if (weekStart !== "monday") return date.getFullYear();
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + 3); // the Thursday owns the week
  return d.getFullYear();
}

/**
 * Replace `{{week}}`, `{{week:02}}` and `{{year}}` in a scope path.
 *
 * Left alone when the path has no tokens, so this is free for every other
 * entry and can't surprise anyone who isn't using it.
 */
export function expandPathTokens(
  path: string,
  today: Date = new Date(),
  weekStart: "sunday" | "monday" = "sunday"
): string {
  if (!path.includes("{{")) return path;
  const week = weekNumber(today, weekStart);
  return path
    .replace(/\{\{week:02\}\}/gi, String(week).padStart(2, "0"))
    .replace(/\{\{week\}\}/gi, String(week))
    .replace(/\{\{year\}\}/gi, String(weekYear(today, weekStart)));
}

/** Strip surrounding whitespace, quotes, and leading/trailing slashes. */
function normalizePath(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

/**
 * Do two vault paths name the same file?
 *
 * Normalized and case-insensitive, matching `isInScope`: the vault sits on a
 * case-insensitive macOS volume, and the inbox path is typed by hand in
 * settings, so `task inbox.md` must still match `Task inbox.md`. A blank or
 * missing path matches nothing — "no inbox configured" is not "every file".
 */
export function samePath(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = normalizePath(a).toLowerCase();
  const right = normalizePath(b).toLowerCase();
  return left.length > 0 && left === right;
}

/**
 * Split the raw `managedFiles` setting into one entry per line.
 *
 * **One path per line, and a comma is not a separator.** It was, until a
 * daily note named `2. Day Planners/26-11-24, Tuesday.md` split into
 * `2. Day Planners/26-11-24` (no `.md`, so read as a folder that doesn't
 * exist) and `Tuesday.md` (a vault-root file that doesn't exist). The note
 * was never in scope, so tasks written into it parsed correctly and were then
 * silently dropped — and since `scopeIncludesPath` split the same way, the
 * "already tracked?" check always answered no and kept appending the path
 * again on every capture.
 *
 * A comma is a legal filename character and a date format people actually
 * use, so no amount of cleverness makes it a safe delimiter. A newline is not
 * legal in a filename, which is the whole argument. Legacy comma lists are
 * rewritten once on load by `splitLegacyCommaList`, which can ask the vault
 * which reading is real.
 */
function splitScopeEntries(raw: string | undefined | null): string[] {
  return (raw ?? "").split(/\n/).map(normalizePath).filter((p) => p.length > 0);
}

// --- Heading-scoped entries ----------------------------------------------
//
// `4. Meetings/kanban.md#Important` tracks one section of a note instead of
// the whole thing. The motivating file is John's Betaworks Kanban: 47 open
// checkboxes reach the panel and only 13 are work — the rest are columns of
// portfolio companies, new companies and 2026 goals, which are registers and
// targets, not tasks. A Kanban column *is* a markdown heading, so heading is
// exactly the right grain, and the same applies to any meeting note that
// carries both an agenda and a list of attendees.

/**
 * Split a `path.md#Heading` entry into its two halves.
 *
 * Only splits on a `#` that follows `.md`, so a note genuinely named
 * `C# notes.md` is untouched and a folder entry can't accidentally acquire a
 * heading. The heading half is kept verbatim apart from trimming — it's
 * matched loosely later, so there's nothing to normalize here.
 */
export function splitHeadingSuffix(entry: string): { path: string; heading: string | null } {
  const m = /^(.*\.md)#(.+)$/i.exec(entry);
  if (!m) return { path: entry, heading: null };
  const heading = m[2].trim();
  return heading ? { path: m[1], heading } : { path: m[1], heading: null };
}

/** Lowercase and collapse runs of whitespace, for loose heading comparison. */
function normalizeHeading(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Does a task's heading satisfy a scope entry's heading filter?
 *
 * **Prefix match, not exact.** John's column is literally
 * `Important  .. or (urgent)`; requiring that to be retyped into a settings
 * box is requiring a typo. `#Important` matching it is the humane reading,
 * and headings within one note are distinct enough that a prefix doesn't
 * collide in practice. A task with no heading at all (above the first one)
 * never matches a heading-scoped entry — it isn't in that section.
 */
export function headingMatches(taskHeading: string | null | undefined, needle: string): boolean {
  if (!taskHeading) return false;
  const h = normalizeHeading(taskHeading);
  const n = normalizeHeading(needle);
  return n.length > 0 && (h === n || h.startsWith(n));
}

/**
 * Parse the `managedFiles` setting into scope entries.
 *
 * One entry per line. An entry ending in `.md` is an exact file; everything
 * else is treated as a folder and matched recursively. A `#Heading` suffix on
 * a file narrows it to that section. A blank setting falls back to the default
 * file rather than the whole vault — opening up to 3,000 stray checkboxes
 * should never be the accidental state.
 */
export function parseScope(
  raw: string | undefined | null,
  options: { today?: Date; weekStart?: "sunday" | "monday"; expandTokens?: boolean } = {}
): ManagedScope {
  const { today = new Date(), weekStart = "sunday", expandTokens = true } = options;
  const parts = splitScopeEntries(raw)
    .map((p) => (expandTokens ? expandPathTokens(p, today, weekStart) : p))
    // A leftover `{{…}}` means the user typed a token we don't expand. Drop
    // the entry rather than scanning for a literal file with braces in its name.
    .filter((p) => p.length > 0 && !p.includes("{{"));

  const seen = new Set<string>();
  const entries: ScopeEntry[] = [];
  for (const raw2 of parts) {
    const key = raw2.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Split the heading off before deciding file vs folder, or `notes.md#X`
    // fails the `.md$` test and gets scanned as a folder that doesn't exist.
    const { path, heading } = splitHeadingSuffix(raw2);
    entries.push({
      kind: /\.md$/i.test(path) ? "file" : "folder",
      path,
      heading: /\.md$/i.test(path) ? heading : null,
    });
  }

  if (entries.length === 0) {
    return {
      entries: [{ kind: "file", path: DEFAULT_MANAGED_FILE }],
      usedFallback: true,
    };
  }

  return { entries, usedFallback: false };
}

/**
 * Does `path` (a vault-relative file path) fall inside the managed scope?
 *
 * Compared case-insensitively: the vault lives on a case-insensitive macOS
 * volume, so `tasks.md` typed in settings should still match `Tasks.md`.
 */
export function isInScope(path: string, scope: ManagedScope): boolean {
  const p = normalizePath(path).toLowerCase();
  for (const entry of scope.entries) {
    const e = entry.path.toLowerCase();
    if (entry.kind === "file") {
      if (p === e) return true;
    } else if (p.startsWith(`${e}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Is this *task* in scope — file and, where the entry names one, heading?
 *
 * `isInScope` answers "should I read this file", which is still a whole-file
 * question even when only one section is tracked. This answers "should this
 * line reach the panel". An unrestricted entry for the file wins over a
 * heading-scoped one, so adding `notes.md` alongside `notes.md#Agenda` opens
 * the whole note rather than quietly keeping it narrow.
 */
export function isTaskInScope(
  task: { filePath: string; heading?: string | null },
  scope: ManagedScope
): boolean {
  const p = normalizePath(task.filePath).toLowerCase();
  for (const entry of scope.entries) {
    const e = entry.path.toLowerCase();
    const fileMatches = entry.kind === "file" ? p === e : p.startsWith(`${e}/`);
    if (!fileMatches) continue;
    if (!entry.heading) return true; // whole file (or folder) is tracked
    if (headingMatches(task.heading, entry.heading)) return true;
  }
  return false;
}

/** Filter an already-parsed task list down to the managed scope. */
export function filterTasksToScope(tasks: SmartTask[], scope: ManagedScope): SmartTask[] {
  return tasks.filter((t) => isTaskInScope(t, scope));
}

/**
 * The file new tasks get appended to, and the one auto-created on load.
 *
 * First explicit file entry wins. If the scope is folders only, we anchor a
 * `Tasks.md` inside the first folder — that keeps "add task" working without
 * forcing the user to also name a file.
 *
 * **Heading-scoped files are skipped.** A capture appended to the end of a
 * note tracked only as `notes.md#Agenda` lands outside the tracked section,
 * so it would be written, parsed, and then dropped by the scope filter —
 * which is precisely the invisible-task failure 0.15.0 exists to kill.
 */
export function primaryManagedFile(scope: ManagedScope): string {
  const file = scope.entries.find((e) => e.kind === "file" && !e.heading);
  if (file) return file.path;
  const folder = scope.entries.find((e) => e.kind === "folder");
  if (folder) return `${folder.path}/${DEFAULT_MANAGED_FILE}`;
  return DEFAULT_MANAGED_FILE;
}

// --- Editing the scope from outside settings -----------------------------
//
// Project notes are the common case for widening scope: a Thanksgiving prep
// checklist, a launch plan, a trip list. Each is a handful of checkboxes that
// want to be in the panel for a week and then stop mattering. Making that a
// trip to a settings textarea to hand-type a path guarantees it doesn't
// happen — so these back a command and a right-click entry on the note.
//
// They work on the raw setting string rather than the parsed scope so the
// user's own ordering survives a toggle, and so the *first* entry — which is
// the capture target — never moves.

/** Split the raw setting the way parseScope does. */
function rawEntries(raw: string | undefined | null): string[] {
  return splitScopeEntries(raw);
}

/**
 * Is this path already named in the raw setting?
 *
 * Compares against each entry *expanded*, so the week page matches the
 * `{{week}}` pattern that produced it. Without this, right-clicking the live
 * week page would offer "track" on a note already in scope, and the toggle
 * would append a second, frozen copy of today's path.
 */
export function scopeIncludesPath(
  raw: string | undefined | null,
  path: string,
  options: { today?: Date; weekStart?: "sunday" | "monday" } = {}
): boolean {
  const { today = new Date(), weekStart = "sunday" } = options;
  const needle = splitHeadingSuffix(normalizePath(path)).path.toLowerCase();
  return rawEntries(raw).some((p) => {
    // Compare file paths with any `#Heading` stripped from both sides. A note
    // tracked as `kanban.md#Important` *is* tracked — answering no would let
    // right-click → Track append the whole file and undo the narrowing.
    const base = splitHeadingSuffix(p).path;
    return (
      base.toLowerCase() === needle ||
      splitHeadingSuffix(expandPathTokens(p, today, weekStart)).path.toLowerCase() === needle
    );
  });
}

/**
 * Append `path` to the scope. Appends rather than prepends on purpose: the
 * first file entry is where new captures land, and tracking a project note
 * must never hijack that.
 */
export function addPathToScope(raw: string | undefined | null, path: string): string {
  const clean = normalizePath(path);
  if (!clean || scopeIncludesPath(raw, clean)) return raw ?? "";
  const existing = (raw ?? "").trim();
  if (!existing) return clean;
  return `${existing}\n${clean}`;
}

/**
 * Remove `path` from the scope, leaving every other entry as written.
 *
 * Matches a token pattern by its expansion too — "stop tracking this note" on
 * the live week page has to remove the `{{week}}` entry that put it there, or
 * the command appears to do nothing and the page is back next repaint.
 */
export function removePathFromScope(
  raw: string | undefined | null,
  path: string,
  options: { today?: Date; weekStart?: "sunday" | "monday" } = {}
): string {
  const { today = new Date(), weekStart = "sunday" } = options;
  const needle = splitHeadingSuffix(normalizePath(path)).path.toLowerCase();
  // Drops every entry for the file, heading-scoped ones included: "stop
  // tracking this note" means the note, not one of its sections.
  const kept = rawEntries(raw).filter(
    (p) =>
      splitHeadingSuffix(p).path.toLowerCase() !== needle &&
      splitHeadingSuffix(expandPathTokens(p, today, weekStart)).path.toLowerCase() !== needle
  );
  return kept.join("\n");
}

// --- One-time migration off comma-separated lists ------------------------

/**
 * Rewrite a legacy comma-separated `managedFiles` value as one path per line.
 *
 * The hard case is the one that caused the bug: `2. Day Planners/26-11-24,
 * Tuesday.md` is a single real file whose name contains a comma, and
 * `Tasks.md, Projects/Launch.md` is two. Nothing about the text distinguishes
 * them — so we ask the vault. `exists` is a path → boolean probe (in the
 * plugin, `app.vault.getAbstractFileByPath`); we walk the comma-separated
 * tokens and greedily rejoin the longest run that names something real.
 *
 * When no run resolves we fall back to the single token, which is the old
 * behaviour: a path that doesn't exist yet (a week page for a week that hasn't
 * started, a `{{week}}` pattern, a folder about to be created) stays as typed
 * rather than being silently merged into its neighbour.
 *
 * Returns `null` when there is nothing to do, so the caller can skip the
 * settings write entirely on the overwhelmingly common already-migrated path.
 */
export function splitLegacyCommaList(
  raw: string | undefined | null,
  exists: (path: string) => boolean
): string | null {
  const value = raw ?? "";
  if (!value.includes(",")) return null;

  const out: string[] = [];
  for (const line of value.split(/\n/)) {
    const tokens = line.split(",");
    let i = 0;
    while (i < tokens.length) {
      // Longest run first: prefer the real `26-11-24, Tuesday.md` over the
      // `26-11-24` prefix that happens to parse.
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
        // Nothing longer resolved — keep the single token as typed.
        const single = normalizePath(tokens[i]);
        if (single) out.push(single);
        taken = 1;
      }
      i += taken;
    }
  }

  // Dedupe: the broken `scopeIncludesPath` let the auto-track path append the
  // same note on every capture, so real-world settings have it 4× over.
  const seen = new Set<string>();
  const deduped = out.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const migrated = deduped.join("\n");
  return migrated === value ? null : migrated;
}

/** Human-readable scope summary for the settings tab and the empty state. */
export function describeScope(scope: ManagedScope): string {
  return scope.entries
    .map((e) => {
      if (e.kind === "folder") return `${e.path}/ (folder)`;
      return e.heading ? `${e.path} › ${e.heading}` : e.path;
    })
    .join(", ");
}
