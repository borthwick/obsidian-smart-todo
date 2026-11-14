// Smart ToDo — shared types.
//
// Storage model is deliberately "no database": a task IS a markdown list item
// in the vault, encoded the way the Tasks plugin (emoji dates) and Dataview
// (inline `[key:: value]` fields) already encode it. That means every task
// stays readable and editable without this plugin installed, and Tasks /
// Dataview queries keep working against the same lines.

export type TaskStatus = "open" | "done";

export type Effort = "light" | "moderate" | "heavy";

export const EFFORTS: Effort[] = ["light", "moderate", "heavy"];

/** Heavier work sorts first inside a due-date group — hard things decay fastest. */
export const EFFORT_WEIGHT: Record<Effort, number> = {
  heavy: 3,
  moderate: 2,
  light: 1,
};

export interface SmartTask {
  /** Vault-relative path of the file the line lives in. */
  filePath: string;
  /** Zero-based line index within that file. */
  lineNumber: number;
  /** The exact source line, verbatim. Used as the write-back safety check. */
  rawText: string;
  /** Line text with emoji dates and inline fields stripped out. */
  title: string;
  status: TaskStatus;
  due: Date | null;
  defer: Date | null;
  doneDate: Date | null;
  effort: Effort | null;
  pushes: number;
  project: string | null;
  assigned: string | null;
}

// --- Managed scope -------------------------------------------------------
//
// Smart ToDo is opt-in by design. The vault holds thousands of legacy open
// checkboxes (meeting notes, old planners, imported docs) that are *not*
// managed tasks; scanning them all would bury the handful that matter. So the
// plugin only ever looks at files the user has explicitly put in scope.

/** One resolved scope entry: an exact file, or a folder matched recursively. */
export interface ScopeEntry {
  kind: "file" | "folder";
  /** Vault-relative, slash-normalized, no leading/trailing slash. */
  path: string;
}

export interface ManagedScope {
  entries: ScopeEntry[];
  /**
   * True when the setting was blank/unparseable and we fell back to the
   * default file. Surfaced in the view so an empty list is never mysterious.
   */
  usedFallback: boolean;
}

export interface SmartTodoSettings {
  /**
   * Comma-separated list of managed file paths and/or folder paths.
   * An entry ending in `.md` is a file; anything else is a folder (recursive).
   */
  managedFiles: string;
}

/** Where tasks live, and what gets auto-created, out of the box. */
export const DEFAULT_MANAGED_FILE = "Tasks.md";

export const DEFAULT_SETTINGS: SmartTodoSettings = {
  managedFiles: DEFAULT_MANAGED_FILE,
};

export type TabId = "today" | "week" | "overdue" | "backlog" | "completed";

export interface TabDef {
  id: TabId;
  label: string;
}

export const TABS: TabDef[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "overdue", label: "Overdue" },
  { id: "backlog", label: "Backlog" },
  { id: "completed", label: "Completed" },
];

export const VIEW_TYPE_SMART_TODO = "smart-todo-view";
