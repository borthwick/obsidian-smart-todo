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
 * Parse the `managedFiles` setting into scope entries.
 *
 * Accepts comma- or newline-separated entries so a longer list can be pasted
 * as lines. An entry ending in `.md` is an exact file; everything else is
 * treated as a folder and matched recursively. A blank setting falls back to
 * the default file rather than the whole vault — opening up to 3,000 stray
 * checkboxes should never be the accidental state.
 */
export function parseScope(raw: string | undefined | null): ManagedScope {
  const parts = (raw ?? "")
    .split(/[,\n]/)
    .map(normalizePath)
    .filter((p) => p.length > 0);

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

/** Human-readable scope summary for the settings tab and the empty state. */
export function describeScope(scope: ManagedScope): string {
  return scope.entries
    .map((e) => (e.kind === "folder" ? `${e.path}/ (folder)` : e.path))
    .join(", ");
}
