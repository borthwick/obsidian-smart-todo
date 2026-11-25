// Smart ToDo — shared types.
//
// Storage model is deliberately "no database": a task IS a markdown list item
// in the vault, encoded the way the Tasks plugin (emoji dates) and Dataview
// (inline `[key:: value]` fields) already encode it. That means every task
// stays readable and editable without this plugin installed, and Tasks /
// Dataview queries keep working against the same lines.

export type TaskStatus = "open" | "done";

/** Tasks-plugin priority levels, read from 🔺⏫🔼🔽⏬ on the line. */
export type TaskPriority = "highest" | "high" | "medium" | "low" | "lowest";

/**
 * Where a task's importance came from.
 *
 * Carried so the panel can show its reasoning. Importance decides which
 * Eisenhower section a task lands in, and inferring it from markup the user
 * wrote for other reasons is only acceptable if the inference is legible —
 * otherwise work moves between sections for no visible cause.
 */
export type ImportanceSource = "field" | "priority" | "heading" | "parent" | null;

/** The emoji a priority was written as, echoed back in the row's meta line. */
export const PRIORITY_MARK: Record<TaskPriority, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

/**
 * Headings that declare their whole subtree important.
 *
 * Lives here rather than in the parser because it's a default *setting* — the
 * parser reads whatever the user ends up with. The week page's
 * `##### Focus this week, what is Important and Urgent` is the motivating case:
 * the judgment was made once for a list instead of once per line.
 */
export const DEFAULT_IMPORTANT_HEADINGS = [
  "important",
  "urgent",
  "focus this week",
  "priorities",
  "priority",
];

export type Effort = "light" | "moderate" | "heavy" | "deep";

export const EFFORTS: Effort[] = ["light", "moderate", "heavy", "deep"];

/** Heavier work sorts first inside a due-date group — hard things decay fastest. */
export const EFFORT_WEIGHT: Record<Effort, number> = {
  deep: 4,
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
  light: "3 min",
  moderate: "15 min",
  heavy: "1 hour",
  deep: "Deep work",
};

/**
 * Nominal minutes per effort level.
 *
 * These are the *ceiling* of each bucket, not an estimate of the individual
 * task, and that's deliberate: the number exists to answer "can I clear this
 * group before my next meeting", and a budget you can beat is more useful than
 * one you can miss. Summed totals are always labelled "about".
 */
export const EFFORT_MINUTES: Record<Effort, number> = {
  light: 3,
  moderate: 15,
  heavy: 60,
  deep: 120,
};

/** Sub-label shown under a lane header — what this size of task actually is. */
export const EFFORT_BLURB: Record<Effort, string> = {
  light: "Clear them in one sitting",
  moderate: "Between meetings",
  heavy: "Needs a block",
  deep: "More than an hour",
};

export const QUICKIE_HEADING = "Quickies · 3 minutes or less";

// --- Time budget ---------------------------------------------------------
//
// The pivot that unlocked the UI. Effort was a *label* on a task; a budget is
// a *question the panel asks you* — "how much time do you actually have right
// now?" — and everything that doesn't fit the answer disappears. That turns
// the third axis from another thing to configure into a single tap.
//
// Budgets are cumulative: picking 15 min shows the 3-minute tasks too, because
// a fifteen-minute window is a fine place to clear three quickies.

export type Budget = "3m" | "15m" | "1h" | "any";

export interface BudgetDef {
  id: Budget;
  label: string;
  /** Effort levels that fit inside this budget. */
  fits: Effort[];
}

export const BUDGETS: BudgetDef[] = [
  { id: "3m", label: "3 min", fits: ["light"] },
  { id: "15m", label: "15 min", fits: ["light", "moderate"] },
  { id: "1h", label: "1 hour", fits: ["light", "moderate", "heavy"] },
  { id: "any", label: "Any", fits: ["light", "moderate", "heavy", "deep"] },
];

// --- View modes ----------------------------------------------------------
//
// 0.7.0 had seven "when" tabs × eight quadrant buttons × a matrix toggle × a
// layout toggle. Every one was reachable and the combination was unreadable.
// Three modes replace all of it, because the mockups made the real structure
// obvious: the three axes are not three views, they're three different *kinds*
// of control. Category and budget are FILTERS (they narrow one list); the
// Eisenhower quadrant is the GROUPING (it's how that list is sectioned).
//
//   Focus — one list, filtered by budget + category, grouped by quadrant
//   Sweep — only what fits the budget, as a timed run-through
//   Lanes — the same set split into effort columns
//
// "When" survives as a single horizon control rather than seven tabs.

export type ViewMode = "focus" | "sweep" | "lanes";

export interface ModeDef {
  id: ViewMode;
  label: string;
  icon: string;
}

export const MODES: ModeDef[] = [
  { id: "focus", label: "Focus", icon: "sun" },
  { id: "sweep", label: "Sweep", icon: "zap" },
  { id: "lanes", label: "Lanes", icon: "columns-3" },
];

/** The "when" axis, collapsed from seven tabs into one menu. */
export type Horizon = "today" | "week" | "all" | "deferred" | "done";

export const HORIZONS: Array<{ id: Horizon; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
  // "All" means all the work in play, not every line in the vault: a task
  // deferred past DEFER_HORIZON_DAYS is parked, and parked work in the main
  // list is noise you have to re-skip every time you look. Deferred is where
  // it goes, and it's one menu item away rather than a setting.
  { id: "deferred", label: "Deferred" },
  { id: "done", label: "Done" },
];

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
  /**
   * The literal character between the brackets. Themes define custom statuses
   * (`/` in progress, `>` forwarded, `u`), and an unrecognised one must round-
   * trip rather than be normalised away by an unrelated edit.
   */
  marker: string;
  /** `- [-]` — abandoned rather than finished. Counted as closed, shown apart. */
  cancelled: boolean;
  /** Leading whitespace width, tabs as 4. Only the ordering is meaningful. */
  indent: number;
  /** Line number of the nearest less-indented task above, if any. */
  parentLine?: number | null;
  /** Open direct descendants — filled by `markParents` after a whole scan. */
  openChildren?: number;
  /** Nearest markdown heading above the line, HTML and marks stripped. */
  heading: string | null;
  /** Priority read from the line's 🔺⏫🔼🔽⏬, if it carries one. */
  priority: TaskPriority | null;
  importantFrom: ImportanceSource;
  due: Date | null;
  defer: Date | null;
  doneDate: Date | null;
  /**
   * Set when a capture was let go rather than finished (Drop in the Inbox
   * bucket). Stored as `[dropped:: YYYY-MM-DD]` on an otherwise completed
   * line, so "I decided not to" stays distinguishable from "I did it".
   */
  dropped: Date | null;
  effort: Effort | null;
  /**
   * The duration the line actually carried, when it carried one.
   *
   * `effort` is the bucket every filter works in; this is the number behind it.
   * Morgen sends real estimates (`PT30M`), and bucketing throws the number
   * away — `30m` and `1 hour` both land in `heavy`, but only one of them is
   * what was written. Null when the line says a bucket word, which has no
   * number to keep.
   */
  effortMinutes: number | null;
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
  { id: "do", urgent: true, important: true, label: "Do first", advice: "Urgent and important" },
  { id: "schedule", urgent: false, important: true, label: "Schedule", advice: "Important, not urgent" },
  { id: "delegate", urgent: true, important: false, label: "Delegate", advice: "Urgent, not important" },
  { id: "drop", urgent: false, important: false, label: "Drop", advice: "Neither — let it go" },
];

/** Section order in Focus mode: the Eisenhower reading order, top to bottom. */
export const QUADRANT_ORDER: Quadrant[] = ["do", "schedule", "delegate", "drop"];

export function quadrantFor(urgent: boolean, important: boolean): Quadrant {
  if (urgent && important) return "do";
  if (!urgent && important) return "schedule";
  if (urgent && !important) return "delegate";
  return "drop";
}

/**
 * HSL accent per quadrant, for the colored pill and the section rule.
 *
 * Urgent red is #B65259 — the same red the spiral uses for the `/` menu's
 * urgent row and for the overdue hairline, so the panel has one red and it
 * always means the same thing. The rest keeps OmniFocus's vocabulary: flagged
 * orange to hand off, deferred indigo to plan, grey for the pile you've
 * stopped caring about.
 */
export const QUADRANT_COLOR: Record<Quadrant, string> = {
  do: "#b65259", // urgent red — fire
  schedule: "hsl(240, 18%, 51%)", // #6B6B99 — plan
  delegate: "hsl(36, 100%, 48%)", // OmniFocus flag orange — hand off
  drop: "hsl(220, 9%, 55%)", // grey — let go
};

// --- Accent --------------------------------------------------------------
//
// The green was a first guess at "distinctive". The default is now the
// OmniFocus indigo (#6B6B99) — it's the palette the real list has lived in for
// years, it's muted enough to sit under headings without shouting, and it
// stays clear of the red/amber the matrix already spends on urgency. The
// choice is a setting, not a hardcode, because it's exactly the kind of thing
// that gets second-guessed.

export type Accent = "omnifocus" | "blue" | "green" | "slate";

/** [base, hover/strong] — written to CSS custom properties on the root. */
export const ACCENTS: Record<Accent, { label: string; base: string; strong: string }> = {
  // #6B6B99 — John's OmniFocus title indigo, converted to HSL so the strong
  // variant is a pure lightness step rather than a second eyeballed hex.
  omnifocus: {
    label: "OmniFocus indigo",
    base: "hsl(240, 18%, 51%)",
    strong: "hsl(240, 22%, 38%)",
  },
  blue: { label: "Blue", base: "hsl(214, 72%, 42%)", strong: "hsl(214, 78%, 32%)" },
  green: { label: "Forest green", base: "hsl(149, 61%, 20%)", strong: "hsl(149, 61%, 14%)" },
  slate: { label: "Slate", base: "hsl(215, 25%, 35%)", strong: "hsl(215, 28%, 25%)" },
};

/**
 * Write the accent custom properties onto an element.
 *
 * This belongs on `document.body`, not on the panel. Obsidian mounts modals in
 * `.modal-container` at body level, *outside* the view's DOM — so properties
 * set on the panel never reached the sweep screen, and every `var(--stw-accent)`
 * there resolved to nothing: no progress ring, no accent badge, and a "Done"
 * button rendering white-on-white because its background had vanished.
 */
export function applyAccentVars(el: HTMLElement, accent: Accent): void {
  const def = ACCENTS[accent] ?? ACCENTS.omnifocus;
  el.style.setProperty("--stw-accent", def.base);
  el.style.setProperty("--stw-accent-strong", def.strong);
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
  /**
   * Track only one section of the file: everything under this heading.
   *
   * Written as a `#Heading` suffix on the path. Some notes are several things
   * at once — a Kanban board whose columns are headings is the clearest case,
   * and meeting notes are the common one. Tracking the file whole puts a
   * register of company names into the task panel as though they were work.
   * Null means the whole file, which stays the default.
   */
  heading?: string | null;
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
  /**
   * The capture file, if there is one. Open tasks living here are *untriaged*:
   * they appear in their own Inbox bucket at the top of the panel and nowhere
   * else, with Keep / Edit / Drop instead of the usual row controls.
   *
   * Why a separate bucket rather than one merged list: voice capture is
   * deliberately frictionless, so what lands here is half-formed — no size, no
   * category, usually no date. Merged into the working list those items either
   * add clutter or, being undated, disappear from Today altogether, which is
   * how a capture silently goes nowhere. Blank disables the idea entirely and
   * the file (if it's in scope at all) behaves like any other.
   */
  inboxFile: string;
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
  /** Panel accent color. */
  accent: Accent;
  /** Which mode the panel opens in. */
  defaultMode: ViewMode;
  /** Seconds on the Sweep timer per task. */
  sweepSeconds: number;
  /**
   * Show the "N quick wins · about Xm — Sweep" banner inside the Focus list.
   * It's the single highest-value element from the mockups: it makes the pile
   * of small stuff a *batch with a button* instead of noise between real work.
   */
  showSweepBanner: boolean;
  /**
   * Display name per tracked note, keyed by vault path.
   *
   * The filename is the default and it's usually wrong as a heading: "Turkey
   * Fry Prep — Thanksgiving 2026 🦃" is a page title, not a label for the ten
   * errands inside it. Rename the group to what the batch *is* ("Frying
   * turkey items") without renaming the note.
   */
  sourceLabels: Record<string, string>;
  /** Paths whose group is folded shut. Folding has to survive a reload. */
  collapsedSources: string[];
  /**
   * Scope entries may contain `{{week}}`, `{{week:02}}` and `{{year}}`.
   *
   * The weekly page is the one note whose path is a moving target. Tracking
   * `Week 48 of 2026.md` by hand means re-tracking it every Monday and
   * remembering to untrack last week's — which nobody does, so the panel ends
   * up showing a stale focus list, the worst possible failure for a page whose
   * entire job is saying what matters *now*. A pattern follows the calendar.
   */
  weekTokensEnabled: boolean;
  /**
   * Which day a week number rolls over on.
   *
   * John's vault numbers Sunday-start weeks — `Week 48 of 2026` is the page he
   * wrote on Sunday 22 Nov 2026 for the week ahead, where ISO-8601 would call
   * that date week 47. Guessing wrong puts the panel on the wrong page, so it
   * is a setting with his convention as the default.
   */
  weekStart: "sunday" | "monday";
  /**
   * Headings whose tasks are important, matched as case-insensitive substrings.
   *
   * Empty disables heading inference entirely; priority emoji still apply.
   */
  importantHeadings: string[];
  /** Split a tracked note's group into sub-sections by its own headings. */
  groupByHeading: boolean;
  /**
   * Render task metadata as compact chips in Live Preview, revealing the raw
   * `[key:: value]` text when the cursor is on the line.
   *
   * The plain notation is the right thing to have *in the file* — readable,
   * greppable, no emoji vocabulary to memorise — and the wrong thing to stare
   * at while writing, because it's wide. Chips reconcile the two. A setting
   * rather than a fact because it draws over text the user typed, and that
   * should always be refusable.
   */
  metadataChips: boolean;
  /**
   * Where the inline `/` menu answers: everywhere, only in tracked notes, or
   * nowhere.
   *
   * It fires on a bare keystroke, so it is the most intrusive surface the
   * plugin has — `everywhere` is the default because the note you are most
   * likely to be typing in when a task occurs to you is the one nobody has
   * added to scope, but it has to be refusable in one click.
   */
  inlineSuggest: InlineSuggestMode;
}

/** Where the `/` task menu is allowed to open. */
export type InlineSuggestMode = "everywhere" | "tracked" | "off";

export type Layout = "card" | "table";

/** Where tasks live, and what gets auto-created, out of the box. */
export const DEFAULT_MANAGED_FILE = "Tasks.md";

export const DEFAULT_SETTINGS: SmartTodoSettings = {
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
  inlineSuggest: "everywhere",
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

/** The category filter row: the three categories plus "everything". */
export type CategoryFilter = Category | "all";

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
