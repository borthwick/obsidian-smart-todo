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

/**
 * Effort is tagged on every task but only *light* earns screen space: a
 * "3 minutes or less" marker is actionable (you can clear five of them while
 * the kettle boils), whereas a Moderate/Heavy pill on every row is noise you
 * already knew. Moderate/Heavy still sort and still show in the editor.
 */
export const EFFORT_LABEL: Record<Effort, string> = {
  light: "Quickie",
  moderate: "Moderate",
  heavy: "Heavy",
};

export const QUICKIE_HEADING = "Quickies · 3 minutes or less";

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
  /**
   * Eisenhower "important" axis. A stored judgment: does this matter to a goal,
   * regardless of when it's due. Null = unjudged (shown distinctly from an
   * explicit "not important"). Urgency is NOT stored — it's derived from the
   * due date (see `isUrgent`), because "is it time-pressing" is a fact the
   * dates already know, while "does it matter" is a call only the user makes.
   */
  important: boolean | null;
}

// --- Eisenhower matrix ---------------------------------------------------
//
// Two axes: urgent (derived from due date) × important (a stored judgment).
// Four quadrants drive the classic advice — do / schedule / delegate / drop.

export type Quadrant = "do" | "schedule" | "delegate" | "drop";

export interface QuadrantDef {
  id: Quadrant;
  /** Urgent × Important truth values that land here. */
  urgent: boolean;
  important: boolean;
  label: string;
  /** The classic Eisenhower verb for this quadrant. */
  advice: string;
}

/** Q1 do, Q2 schedule, Q3 delegate, Q4 drop. */
export const QUADRANTS: QuadrantDef[] = [
  { id: "do", urgent: true, important: true, label: "Do", advice: "Do now" },
  { id: "schedule", urgent: false, important: true, label: "Schedule", advice: "Decide when" },
  { id: "delegate", urgent: true, important: false, label: "Delegate", advice: "Delegate / quick-win" },
  { id: "drop", urgent: false, important: false, label: "Drop", advice: "Drop or defer" },
];

export function quadrantFor(urgent: boolean, important: boolean): Quadrant {
  if (urgent && important) return "do";
  if (!urgent && important) return "schedule";
  if (urgent && !important) return "delegate";
  return "drop";
}

/** HSL accent per quadrant, for the colored pill in the row. */
export const QUADRANT_COLOR: Record<Quadrant, string> = {
  do: "hsl(4, 72%, 54%)", // red — fire
  schedule: "hsl(210, 68%, 54%)", // blue — plan
  delegate: "hsl(38, 82%, 52%)", // amber — hand off
  drop: "hsl(220, 9%, 55%)", // grey — let go
};

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
  /** Pushes count at or above which the badge turns amber (the Onda signal). */
  pushesWarnThreshold: number;
  /** "card" (stacked rows) or "table" (Onda-style sortable columns). */
  defaultLayout: Layout;
  /**
   * Collect light-effort tasks into their own "Quickies" group at the foot of
   * the list instead of interleaving them. Effort is still tagged on every
   * task; this is purely about what the panel shows.
   */
  groupQuickies: boolean;
}

export type Layout = "card" | "table";

/** Where tasks live, and what gets auto-created, out of the box. */
export const DEFAULT_MANAGED_FILE = "Tasks.md";

export const DEFAULT_SETTINGS: SmartTodoSettings = {
  managedFiles: DEFAULT_MANAGED_FILE,
  pushesWarnThreshold: 3,
  defaultLayout: "card",
  groupQuickies: true,
};

// --- Categories ----------------------------------------------------------
//
// Projects used to be free text, which meant 11 near-synonymous buckets
// (Investing / Betaworks / Finance / Home / Family / Relationships…) and no
// way to scan the list by life-area. John's call: exactly three categories.
// They're stored in the same `[project:: …]` field so Dataview/Tasks queries
// and old lines keep working — the constraint is in the UI, not the format.

export type Category = "betaworks" | "personal" | "health";

export const CATEGORIES: Category[] = ["betaworks", "personal", "health"];

export const CATEGORY_LABEL: Record<Category, string> = {
  betaworks: "Betaworks",
  personal: "Personal",
  health: "Health",
};

export const CATEGORY_COLOR: Record<Category, string> = {
  betaworks: "hsl(212, 70%, 55%)", // blue — work
  personal: "hsl(150, 50%, 46%)", // green — life
  health: "hsl(28, 80%, 55%)", // amber — body
};

/**
 * Fold a legacy free-text project onto one of the three categories.
 *
 * Deliberately total: anything unrecognised lands in `personal`, because an
 * unmapped value is almost always a life bucket, and leaving it unmapped
 * would quietly recreate the sprawl this replaces. The migration preview
 * shows every change before it's written, so a wrong guess is one click to fix.
 */
export const CATEGORY_ALIASES: Record<string, Category> = {
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
  "smart todo": "personal",
};

/** Exact match on an already-canonical value, else null. */
export function asCategory(raw: string | null | undefined): Category | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return (CATEGORIES as string[]).includes(v) ? (v as Category) : null;
}

/** Best-effort fold of any project string onto a category. */
export function categoryFor(raw: string | null | undefined): Category | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  return asCategory(v) ?? CATEGORY_ALIASES[v] ?? "personal";
}

export type TabId =
  | "today"
  | "tomorrow"
  | "week"
  | "overdue"
  | "backlog"
  | "completed"
  | "assigned";

export interface TabDef {
  id: TabId;
  label: string;
}

export const TABS: TabDef[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This Week" },
  { id: "overdue", label: "Overdue" },
  { id: "backlog", label: "Backlog" },
  { id: "completed", label: "Completed" },
  { id: "assigned", label: "Assigned" },
];

// --- Eisenhower filter buttons -------------------------------------------
//
// A second filter axis layered on top of the tabs. The tabs answer "when"
// (today / week / backlog); these buttons answer "what kind" (which quadrant).
// They compose: "This Week" + "Urgent & Important" = this week's fires.
//
// John wants breadth first — ship many buttons, prune later — so every useful
// slice of the matrix gets its own button, not just the four raw quadrants.

export type QuadFilterId =
  | "all"
  | "do" // urgent + important
  | "schedule" // important, not urgent
  | "delegate" // urgent, not important
  | "drop" // neither
  | "urgent" // urgent, either importance
  | "important" // important, either urgency
  | "unjudged"; // importance not yet set — the review queue

export interface QuadFilterDef {
  id: QuadFilterId;
  label: string;
}

export const QUAD_FILTERS: QuadFilterDef[] = [
  { id: "all", label: "All" },
  { id: "do", label: "Urgent & Important" },
  { id: "schedule", label: "Important · Not urgent" },
  { id: "delegate", label: "Urgent · Not important" },
  { id: "drop", label: "Neither" },
  { id: "urgent", label: "Just Urgent" },
  { id: "important", label: "Just Important" },
  { id: "unjudged", label: "Needs review" },
];

/** Sortable table columns, matching the Onda reference header row. */
export type SortKey = "title" | "due" | "pushes" | "effort" | "project" | "quadrant";
export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

/**
 * Deterministic color for a project dot — same project always gets the same
 * hue, no config needed. Hash the name into the 0–360 wheel.
 */
export function projectColor(project: string): string {
  let hash = 0;
  for (let i = 0; i < project.length; i++) {
    hash = (hash * 31 + project.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 60%, 55%)`;
}

export const VIEW_TYPE_SMART_TODO = "smart-todo-view";
