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
 * Parse the `managedFiles` setting into scope entries.
 *
 * Accepts comma- or newline-separated entries so a longer list can be pasted
 * as lines. An entry ending in `.md` is an exact file; everything else is
 * treated as a folder and matched recursively. A blank setting falls back to
 * the default file rather than the whole vault — opening up to 3,000 stray
 * checkboxes should never be the accidental state.
 */
export function parseScope(
  raw: string | undefined | null,
  options: { today?: Date; weekStart?: "sunday" | "monday"; expandTokens?: boolean } = {}
): ManagedScope {
  const { today = new Date(), weekStart = "sunday", expandTokens = true } = options;
  const parts = (raw ?? "")
    .split(/[,\n]/)
    .map(normalizePath)
    .map((p) => (expandTokens ? expandPathTokens(p, today, weekStart) : p))
    // A leftover `{{…}}` means the user typed a token we don't expand. Drop
    // the entry rather than scanning for a literal file with braces in its name.
    .filter((p) => p.length > 0 && !p.includes("{{"));

  const seen = new Set<string>();
  const entries: ScopeEntry[] = [];
  for (const path of parts) {
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      kind: /\.md$/i.test(path) ? "file" : "folder",
      path,
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

/** Filter an already-parsed task list down to the managed scope. */
export function filterTasksToScope(tasks: SmartTask[], scope: ManagedScope): SmartTask[] {
  return tasks.filter((t) => isInScope(t.filePath, scope));
}

/**
 * The file new tasks get appended to, and the one auto-created on load.
 *
 * First explicit file entry wins. If the scope is folders only, we anchor a
 * `Tasks.md` inside the first folder — that keeps "add task" working without
 * forcing the user to also name a file.
 */
export function primaryManagedFile(scope: ManagedScope): string {
  const file = scope.entries.find((e) => e.kind === "file");
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
// user's own formatting (commas vs lines, their ordering) survives a toggle,
// and so the *first* entry — which is the capture target — never moves.

/** Split the raw setting the way parseScope does, but keep the separator. */
function rawEntries(raw: string | undefined | null): string[] {
  return (raw ?? "").split(/[,\n]/).map(normalizePath).filter((p) => p.length > 0);
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
  const needle = normalizePath(path).toLowerCase();
  return rawEntries(raw).some(
    (p) =>
      p.toLowerCase() === needle ||
      expandPathTokens(p, today, weekStart).toLowerCase() === needle
  );
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
  // Match whatever separator is already in use so a line-per-entry list stays
  // a line-per-entry list.
  return existing.includes("\n") ? `${existing}\n${clean}` : `${existing}, ${clean}`;
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
  const needle = normalizePath(path).toLowerCase();
  const kept = rawEntries(raw).filter(
    (p) =>
      p.toLowerCase() !== needle &&
      expandPathTokens(p, today, weekStart).toLowerCase() !== needle
  );
  return (raw ?? "").includes("\n") ? kept.join("\n") : kept.join(", ");
}

/** Human-readable scope summary for the settings tab and the empty state. */
export function describeScope(scope: ManagedScope): string {
  return scope.entries
    .map((e) => (e.kind === "folder" ? `${e.path}/ (folder)` : e.path))
    .join(", ");
}
