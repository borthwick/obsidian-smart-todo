// Smart ToDo — ⌘K: one box that both jumps to a task and sets the filters.
//
// The mockup put a prominent search box at the top of the sidebar with the
// placeholder "work, quick, do first…" — i.e. it isn't only a search box, it's
// the keyboard route to every filter. That's the right call for a narrow
// panel: the chips are the discoverable surface, this is the fast one, and
// neither needs its own mental model because they set the same state.
//
// Typing "quick" offers the 3-minute budget. Typing "Blair" offers the task.
// Both live in one list, filters first, because a filter changes what you see
// next while a task is a one-shot jump.

import { App, SuggestModal } from "obsidian";
import {
  BUDGETS,
  Budget,
  CATEGORIES,
  CATEGORY_LABEL,
  CategoryFilter,
  HORIZONS,
  Horizon,
  MODES,
  SmartTask,
  ViewMode,
} from "./types";

export type QuickAction =
  | { kind: "mode"; mode: ViewMode }
  | { kind: "budget"; budget: Budget }
  | { kind: "category"; category: CategoryFilter }
  | { kind: "horizon"; horizon: Horizon }
  | { kind: "search"; text: string }
  | { kind: "task"; task: SmartTask };

interface Row {
  action: QuickAction;
  title: string;
  note: string;
  /** Extra words that should match this row but aren't worth displaying. */
  keywords: string;
}

export class QuickSwitchModal extends SuggestModal<Row> {
  private rows: Row[];
  private onPick: (action: QuickAction) => void;

  constructor(app: App, tasks: SmartTask[], onPick: (action: QuickAction) => void) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder("work, quick, do first, or a task…");
    this.rows = buildRows(tasks);
    this.limit = 40;
  }

  getSuggestions(query: string): Row[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.rows.filter((r) => r.action.kind !== "task").slice(0, 12);

    const hits = this.rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        r.keywords.includes(q)
    );

    // Always offer the raw text as a list filter, so a query that matches
    // nothing by name still does something useful rather than dead-ending.
    hits.push({
      action: { kind: "search", text: query.trim() },
      title: `Filter the list by "${query.trim()}"`,
      note: "Search",
      keywords: "",
    });
    return hits;
  }

  renderSuggestion(row: Row, el: HTMLElement): void {
    el.addClass("stw-qs-row");
    el.createDiv({ cls: "stw-qs-title", text: row.title });
    if (row.note) el.createDiv({ cls: "stw-qs-note", text: row.note });
  }

  onChooseSuggestion(row: Row): void {
    this.onPick(row.action);
  }
}

function buildRows(tasks: SmartTask[]): Row[] {
  const rows: Row[] = [];

  for (const m of MODES) {
    rows.push({
      action: { kind: "mode", mode: m.id },
      title: m.label,
      note: "Mode",
      keywords: `mode view ${m.label.toLowerCase()}`,
    });
  }
  for (const b of BUDGETS) {
    rows.push({
      action: { kind: "budget", budget: b.id },
      title: b.label,
      note: "I have…",
      keywords:
        b.id === "3m"
          ? "quick quickie quick win small short minutes"
          : b.id === "any"
            ? "all everything any"
            : "time budget minutes hour",
    });
  }
  rows.push({
    action: { kind: "category", category: "all" },
    title: "All categories",
    note: "Category",
    keywords: "all everything",
  });
  for (const c of CATEGORIES) {
    rows.push({
      action: { kind: "category", category: c },
      title: CATEGORY_LABEL[c],
      note: "Category",
      keywords: c === "betaworks" ? "work job fund" : c === "personal" ? "life home" : "body",
    });
  }
  for (const h of HORIZONS) {
    rows.push({
      action: { kind: "horizon", horizon: h.id },
      title: h.label,
      note: "When",
      keywords: `when horizon ${h.label.toLowerCase()}`,
    });
  }

  for (const t of tasks) {
    rows.push({
      action: { kind: "task", task: t },
      title: t.title || "(untitled task)",
      note: t.filePath.split("/").pop() ?? t.filePath,
      keywords: (t.project ?? "").toLowerCase(),
    });
  }

  return rows;
}
