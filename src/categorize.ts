// Smart ToDo — one-shot category migration.
//
// The OmniFocus import arrived with eleven ad-hoc project names. Folding them
// onto the three real categories is a bulk rewrite, and bulk rewrites are
// exactly where this plugin has to be most careful: it runs *inside* Obsidian
// through the same single-line write-back as everything else (never a
// filesystem write from outside, which has already cost one file), it shows
// every change before touching anything, and it skips tasks that carry no
// project at all rather than guessing a category for them.

import { App, Modal } from "obsidian";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  Category,
  SmartTask,
  asCategory,
  categoryFor,
} from "./types";

export interface CategoryChange {
  task: SmartTask;
  from: string;
  to: Category;
}

/**
 * Which tasks would change, and to what.
 *
 * Only tasks with an existing non-canonical project are included. An untagged
 * task is left alone — "no category yet" is honest, "personal because we had
 * to pick something" is not.
 */
export function planCategoryMigration(tasks: SmartTask[]): CategoryChange[] {
  const changes: CategoryChange[] = [];
  for (const task of tasks) {
    const raw = task.project?.trim();
    if (!raw) continue;
    if (asCategory(raw)) continue; // already one of the three
    const to = categoryFor(raw);
    if (!to) continue;
    changes.push({ task, from: raw, to });
  }
  return changes;
}

/** Group a plan by target category, for the preview. */
export function groupPlan(
  changes: CategoryChange[]
): Array<{ to: Category; froms: Array<{ from: string; count: number }> }> {
  const byTarget = new Map<Category, Map<string, number>>();
  for (const c of changes) {
    const inner = byTarget.get(c.to) ?? new Map<string, number>();
    inner.set(c.from, (inner.get(c.from) ?? 0) + 1);
    byTarget.set(c.to, inner);
  }
  return CATEGORIES.filter((cat) => byTarget.has(cat)).map((cat) => ({
    to: cat,
    froms: Array.from(byTarget.get(cat)!.entries())
      .map(([from, count]) => ({ from, count }))
      .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from)),
  }));
}

export class CategoryMigrationModal extends Modal {
  constructor(
    app: App,
    private changes: CategoryChange[],
    private onApply: () => void | Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Fold projects into categories" });

    if (this.changes.length === 0) {
      contentEl.createDiv({
        cls: "smart-todo-edit-hint",
        text: "Every tagged task already uses Betaworks, Personal or Health. Nothing to do.",
      });
      const done = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
      const close = done.createEl("button", { cls: "mod-cta", text: "Close" });
      close.addEventListener("click", () => this.close());
      return;
    }

    contentEl.createDiv({
      cls: "smart-todo-edit-hint",
      text: `${this.changes.length} task${
        this.changes.length === 1 ? "" : "s"
      } will be retagged. Tasks with no project are left untouched.`,
    });

    const list = contentEl.createDiv({ cls: "smart-todo-migrate-list" });
    for (const group of groupPlan(this.changes)) {
      const row = list.createDiv({ cls: "smart-todo-migrate-group" });
      const head = row.createDiv({ cls: "smart-todo-migrate-head" });
      head.createSpan({
        cls: "smart-todo-project-dot",
        attr: { style: `background:${CATEGORY_COLOR[group.to]}` },
      });
      head.createSpan({
        cls: "smart-todo-migrate-target",
        text: CATEGORY_LABEL[group.to],
      });
      const froms = row.createDiv({ cls: "smart-todo-migrate-froms" });
      for (const f of group.froms) {
        froms.createDiv({
          cls: "smart-todo-migrate-from",
          text: `${f.from} → ${f.count}`,
        });
      }
    }

    const actions = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", {
      cls: "mod-cta",
      text: `Retag ${this.changes.length}`,
    });
    apply.addEventListener("click", () => {
      this.close();
      void this.onApply();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
