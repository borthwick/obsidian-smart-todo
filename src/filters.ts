// Smart ToDo — filtering + sorting.
//
// Kept separate from the view so the triage rules are readable on their own
// and testable without a DOM.

import { addDays, isSameDay, startOfToday } from "./parser";
import {
  EFFORT_WEIGHT,
  Quadrant,
  QuadFilterId,
  SmartTask,
  TabId,
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
