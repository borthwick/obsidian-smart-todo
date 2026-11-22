// Smart ToDo — filtering + sorting.
//
// Kept separate from the view so the triage rules are readable on their own
// and testable without a DOM.

import { addDays, isSameDay, startOfToday } from "./parser";
import {
  BUDGETS,
  Budget,
  Category,
  CategoryFilter,
  EFFORT_MINUTES,
  EFFORT_WEIGHT,
  Horizon,
  Quadrant,
  QuadFilterId,
  SmartTask,
  TabId,
  categoryFor,
  quadrantFor,
} from "./types";

/**
 * Days within which a due date counts as "urgent". Overdue is always urgent;
 * a task due today or tomorrow is urgent; further out is not. Undated tasks
 * are never urgent — nothing is forcing them.
 */
export const URGENT_WINDOW_DAYS = 2;

export interface Buckets {
  tasks: SmartTask[];
  /** Open tasks hidden from Today/This Week purely because defer is in the future. */
  restingCount: number;
}

/** A task is "resting" while its defer date is still ahead of today. */
export function isResting(task: SmartTask, today = startOfToday()): boolean {
  return !!task.defer && task.defer.getTime() > today.getTime();
}

export function isOverdue(task: SmartTask, today = startOfToday()): boolean {
  return task.status === "open" && !!task.due && task.due.getTime() < today.getTime();
}

export function isDueToday(task: SmartTask, today = startOfToday()): boolean {
  return task.status === "open" && !!task.due && isSameDay(task.due, today);
}

// --- Eisenhower axes -----------------------------------------------------

/**
 * Urgency is DERIVED, never stored: a task is urgent when it's overdue or due
 * within `URGENT_WINDOW_DAYS`. A resting (future-deferred) task is not urgent
 * even if its due date is near — the user has explicitly parked it. Undated
 * tasks are never urgent.
 */
export function isUrgent(task: SmartTask, today = startOfToday()): boolean {
  if (!task.due) return false;
  if (isResting(task, today)) return false;
  const horizon = addDays(today, URGENT_WINDOW_DAYS);
  return task.due.getTime() <= horizon.getTime();
}

/**
 * Importance is the STORED judgment. Unjudged (null) is treated as NOT
 * important for quadrant placement — an un-reviewed task sits in the lower
 * half until the user decides. `isUnjudged` lets the review queue surface
 * those separately so they don't hide forever.
 */
export function isImportant(task: SmartTask): boolean {
  return task.important === true;
}

export function isUnjudged(task: SmartTask): boolean {
  return task.important === null;
}

/** The Eisenhower quadrant this task currently falls in. */
export function quadrantOf(task: SmartTask, today = startOfToday()): Quadrant {
  return quadrantFor(isUrgent(task, today), isImportant(task));
}

/** Does `task` pass the quadrant/axis filter button `filter`? */
export function matchesQuadFilter(
  task: SmartTask,
  filter: QuadFilterId,
  today = startOfToday()
): boolean {
  if (filter === "all") return true;
  const urgent = isUrgent(task, today);
  const important = isImportant(task);
  switch (filter) {
    case "do":
      return urgent && important;
    case "schedule":
      return !urgent && important;
    case "delegate":
      return urgent && !important;
    case "drop":
      return !urgent && !important && !isUnjudged(task);
    case "urgent":
      return urgent;
    case "important":
      return important;
    case "unjudged":
      return isUnjudged(task);
    default:
      return true;
  }
}

// --- Budget, category, horizon -------------------------------------------
//
// The three controls the 0.8 panel actually exposes. Each is a pure predicate
// over one task so the view can compose them freely and the counts in the
// filter chips are computed the same way the list is.

/**
 * Does this task fit inside `budget`?
 *
 * An *untagged* task fits only "Any". That's the deliberate harsh case: if you
 * haven't said how long something takes, it cannot honestly be offered as
 * something you can finish in the next three minutes. It also turns the budget
 * chips into a quiet nudge to tag effort, which nothing else in the UI does.
 */
export function fitsBudget(task: SmartTask, budget: Budget): boolean {
  if (budget === "any") return true;
  if (!task.effort) return false;
  const def = BUDGETS.find((b) => b.id === budget);
  return !!def && def.fits.includes(task.effort);
}

/** Does this task's category pass the category chip row? */
export function matchesCategory(task: SmartTask, filter: CategoryFilter): boolean {
  if (filter === "all") return true;
  // Fold legacy free-text projects on the fly so an un-migrated vault still
  // filters sensibly instead of showing an empty Betaworks tab.
  return categoryFor(task.project) === (filter as Category);
}

/**
 * Minutes this set will plausibly take. Untagged tasks contribute nothing —
 * counting them as zero understates, but inventing a number for work you
 * haven't sized would overstate with false precision, and the total is always
 * printed as "about".
 */
export function estimateMinutes(tasks: SmartTask[]): number {
  return tasks.reduce((sum, t) => sum + (t.effort ? EFFORT_MINUTES[t.effort] : 0), 0);
}

/** "27m", "1h 19m", "2h" — the compact form the group headers use. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * The "when" axis, collapsed from seven tabs to four.
 *
 * `today` keeps the old Today semantics (due today or earlier, not resting).
 * `all` is every open task including undated ones — the thing the old tab set
 * could only reach by visiting Backlog *and* Today and adding them up.
 */
export function matchesHorizon(
  task: SmartTask,
  horizon: Horizon,
  today = startOfToday()
): boolean {
  if (horizon === "done") return task.status === "done";
  if (task.status !== "open") return false;
  switch (horizon) {
    case "today":
      return !isResting(task, today) && !!task.due && task.due.getTime() <= today.getTime();
    case "week": {
      const end = addDays(today, 6);
      // A task resting until Wednesday is still this week's work, so only a
      // rest that runs *past* the window hides it. Without this, pushing a
      // task by a day would drop it out of the week entirely — and "push to
      // tomorrow" must never mean "disappear".
      if (task.defer && task.defer.getTime() > end.getTime()) return false;
      return !!task.due && task.due.getTime() <= end.getTime();
    }
    default:
      return true;
  }
}

export interface PanelQuery {
  horizon: Horizon;
  budget: Budget;
  category: CategoryFilter;
  /** Free text from the search box; empty string means no text filter. */
  search: string;
  /**
   * Search the whole working set instead of the filtered one.
   *
   * Off by default, because the chips have to stay honest: what they say is
   * what the list shows. But a search that only looks inside Today is a search
   * that can't find a finished task or an undated one, and reports "nothing"
   * for a task sitting two lines up in the note. This is the escape hatch the
   * empty state offers once it knows the match is elsewhere.
   */
  searchEverywhere?: boolean;
}

/** Every task whose title contains `needle` — no horizon, budget or category. */
export function matchesSearch(tasks: SmartTask[], search: string): SmartTask[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return [];
  return tasks.filter((t) => t.title.toLowerCase().includes(needle));
}

/**
 * The one selection function the 0.8 panel uses. Horizon → category → budget →
 * text, then the existing triage sort. Everything the view draws — the list,
 * the lanes, the sweep queue, every chip count — comes from this, so a count
 * can never disagree with what clicking that chip actually shows.
 */
export function selectTasks(
  tasks: SmartTask[],
  query: PanelQuery,
  today = startOfToday()
): SmartTask[] {
  const needle = query.search.trim().toLowerCase();
  const everywhere = !!needle && !!query.searchEverywhere;

  const out = tasks.filter((t) => {
    if (needle && !t.title.toLowerCase().includes(needle)) return false;
    if (everywhere) return true;
    if (!matchesHorizon(t, query.horizon, today)) return false;
    if (!matchesCategory(t, query.category)) return false;
    if (!fitsBudget(t, query.budget)) return false;
    return true;
  });

  // Unfiltered search is the one selection that mixes open and finished work,
  // so it needs its own order: live tasks first in triage order, history after
  // in reverse-completion order. Neither comparator can do that alone.
  if (everywhere) {
    return out.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return a.status === "open" ? compareForToday(a, b, today) : compareCompleted(a, b);
    });
  }

  return query.horizon === "done"
    ? out.sort(compareCompleted)
    : out.sort((a, b) => compareForToday(a, b, today));
}

/** Split a selection into the four Eisenhower sections, in reading order. */
export function groupByQuadrant(
  tasks: SmartTask[],
  today = startOfToday()
): Record<Quadrant, SmartTask[]> {
  const out: Record<Quadrant, SmartTask[]> = { do: [], schedule: [], delegate: [], drop: [] };
  for (const t of tasks) out[quadrantOf(t, today)].push(t);
  return out;
}

/**
 * Today ordering: overdue block first, then due-today. Inside a block, heavy
 * effort outranks light (the hard thing is the one that keeps sliding), then
 * the most-pushed task outranks the rest — a high push count is the signal
 * that something needs to either happen or be killed.
 */
export function compareForToday(a: SmartTask, b: SmartTask, today = startOfToday()): number {
  const rank = (t: SmartTask) => {
    if (isOverdue(t, today)) return 0;
    if (isDueToday(t, today)) return 1;
    if (t.due) return 2; // future-dated
    return 3; // undated
  };
  const byRank = rank(a) - rank(b);
  if (byRank !== 0) return byRank;

  // Within overdue, the longest-overdue first.
  if (a.due && b.due && a.due.getTime() !== b.due.getTime()) {
    return a.due.getTime() - b.due.getTime();
  }

  const effortOf = (t: SmartTask) => (t.effort ? EFFORT_WEIGHT[t.effort] : 0);
  const byEffort = effortOf(b) - effortOf(a);
  if (byEffort !== 0) return byEffort;

  const byPushes = b.pushes - a.pushes;
  if (byPushes !== 0) return byPushes;

  return a.title.localeCompare(b.title);
}

function compareCompleted(a: SmartTask, b: SmartTask): number {
  const at = a.doneDate ? a.doneDate.getTime() : 0;
  const bt = b.doneDate ? b.doneDate.getTime() : 0;
  if (at !== bt) return bt - at; // most recently finished first
  return a.title.localeCompare(b.title);
}

/**
 * Split the vault's tasks into the set for `tab`.
 *
 * - Today     — open, not resting, due today or earlier
 * - This Week — open, not resting, due within the next 7 days (overdue included)
 * - Overdue   — open, due before today. Shown regardless of defer: a past due
 *               with a future defer is a contradiction the user should see.
 * - Backlog   — open and not actionable today: resting, undated, or future-dated
 * - Completed — done
 */
export function bucketFor(
  tasks: SmartTask[],
  tab: TabId,
  today = startOfToday(),
  quad: QuadFilterId = "all"
): Buckets {
  // Apply the Eisenhower button first, so the "when" tab then narrows an
  // already-quadrant-filtered set. restingCount is still counted off the full
  // tab set below, so the "resting in backlog" hint stays honest.
  const scoped = quad === "all" ? tasks : tasks.filter((t) => matchesQuadFilter(t, quad, today));
  const open = scoped.filter((t) => t.status === "open");
  const weekEnd = addDays(today, 6);

  let selected: SmartTask[];

  const tomorrow = addDays(today, 1);

  switch (tab) {
    case "today":
      selected = open.filter(
        (t) => !isResting(t, today) && !!t.due && t.due.getTime() <= today.getTime()
      );
      break;
    case "tomorrow":
      // Just tomorrow's actionable work — the "line up the day ahead" view.
      selected = open.filter(
        (t) => !isResting(t, tomorrow) && !!t.due && isSameDay(t.due, tomorrow)
      );
      break;
    case "assigned":
      // Delegated work: anything with an assignee, open or not, so you can
      // track what you're waiting on from other people.
      selected = scoped.filter((t) => !!t.assigned);
      break;
    case "week":
      selected = open.filter(
        (t) => !isResting(t, today) && !!t.due && t.due.getTime() <= weekEnd.getTime()
      );
      break;
    case "overdue":
      selected = open.filter((t) => isOverdue(t, today));
      break;
    case "backlog":
      selected = open.filter(
        (t) => isResting(t, today) || !t.due || t.due.getTime() > today.getTime()
      );
      break;
    case "completed":
      selected = scoped.filter((t) => t.status === "done");
      break;
    default:
      selected = open;
  }

  selected =
    tab === "completed"
      ? selected.sort(compareCompleted)
      : selected.sort((a, b) => compareForToday(a, b, today));

  return {
    tasks: selected,
    restingCount: open.filter((t) => isResting(t, today)).length,
  };
}
