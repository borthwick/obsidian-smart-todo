// Smart ToDo — Today view (right-leaf ItemView).

import { ItemView, Menu, WorkspaceLeaf, setIcon } from "obsidian";
import { bucketFor, isResting } from "./filters";
import { addDays, formatDate, isSameDay, startOfToday } from "./parser";
import { describeScope } from "./scope";
import {
  EFFORTS,
  Effort,
  SmartTask,
  TABS,
  TabId,
  VIEW_TYPE_SMART_TODO,
} from "./types";
import { pushTask, safeWrite, setTaskEffort, toggleTaskDone } from "./writer";
import type SmartTodoPlugin from "./main";

export class SmartTodoView extends ItemView {
  plugin: SmartTodoPlugin;
  activeTab: TabId = "today";
  tasks: SmartTask[] = [];
  loading = false;

  private tabBarEl: HTMLElement;
  private summaryEl: HTMLElement;
  private listEl: HTMLElement;
  private addInputEl: HTMLInputElement;

  constructor(leaf: WorkspaceLeaf, plugin: SmartTodoPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_SMART_TODO;
  }

  getDisplayText(): string {
    return "Smart ToDo";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen(): Promise<void> {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("smart-todo-root");

    const header = root.createDiv({ cls: "smart-todo-header" });
    this.tabBarEl = header.createDiv({ cls: "smart-todo-tabs" });

    const refreshBtn = header.createEl("button", {
      cls: "smart-todo-refresh",
      attr: { "aria-label": "Rescan vault" },
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => void this.refresh());

    this.renderAddRow(root);

    this.summaryEl = root.createDiv({ cls: "smart-todo-summary" });
    this.listEl = root.createDiv({ cls: "smart-todo-list" });

    this.renderTabs();
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.containerEl.children[1]?.empty();
  }

  /** Rescan the vault, then repaint. */
  async refresh(): Promise<void> {
    this.loading = true;
    this.render();
    this.tasks = await this.plugin.scan();
    this.loading = false;
    this.render();
  }

  /**
   * Capture row. Title only — Enter appends `- [ ] <text>` to the managed file
   * and the vault-modify event folds it back into the list. Dates and effort
   * get set afterwards from the row UI, so capture never blocks on metadata.
   */
  private renderAddRow(root: HTMLElement): void {
    const wrap = root.createDiv({ cls: "smart-todo-add" });
    this.addInputEl = wrap.createEl("input", {
      cls: "smart-todo-add-input",
      attr: { type: "text", placeholder: "Add a task…" },
    }) as HTMLInputElement;

    const commit = async (): Promise<void> => {
      const value = this.addInputEl.value.trim();
      if (!value) return;
      this.addInputEl.disabled = true;
      const ok = await this.plugin.addTask(value);
      this.addInputEl.disabled = false;
      if (ok) this.addInputEl.value = "";
      this.addInputEl.focus();
      await this.refresh();
    };

    this.addInputEl.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        void commit();
      } else if (evt.key === "Escape") {
        this.addInputEl.value = "";
        this.addInputEl.blur();
      }
    });

    const addBtn = wrap.createEl("button", {
      cls: "smart-todo-add-btn",
      attr: { "aria-label": "Add task" },
    });
    setIcon(addBtn, "plus");
    addBtn.addEventListener("click", () => void commit());
  }

  private renderTabs(): void {
    this.tabBarEl.empty();
    for (const tab of TABS) {
      const btn = this.tabBarEl.createEl("button", {
        cls: "smart-todo-tab",
        text: tab.label,
      });
      if (tab.id === this.activeTab) btn.addClass("is-active");
      btn.addEventListener("click", () => {
        this.activeTab = tab.id;
        this.renderTabs();
        this.render();
      });
    }
  }

  private render(): void {
    if (!this.listEl) return;
    const today = startOfToday();
    this.listEl.empty();
    this.summaryEl.empty();

    if (this.loading && this.tasks.length === 0) {
      this.summaryEl.setText("Scanning…");
      return;
    }

    const { tasks, restingCount } = bucketFor(this.tasks, this.activeTab, today);

    const countLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
    this.summaryEl.createSpan({ cls: "smart-todo-count", text: countLabel });

    // The resting count is the whole point of defer: it tells you what you've
    // deliberately chosen not to look at, so the short list feels trustworthy.
    if (this.activeTab === "today" || this.activeTab === "week") {
      if (restingCount > 0) {
        this.summaryEl.createSpan({
          cls: "smart-todo-resting",
          text: `${restingCount} ${
            restingCount === 1 ? "task" : "tasks"
          } resting in the backlog.`,
        });
      }
    }

    if (tasks.length === 0) {
      const empty = this.listEl.createDiv({
        cls: "smart-todo-empty",
        text:
          this.activeTab === "completed"
            ? "Nothing completed yet."
            : "Nothing here. Clear.",
      });
      // An empty list is ambiguous without knowing what's in scope — say it,
      // so "no tasks" is never mistaken for "the plugin isn't working".
      if (this.tasks.length === 0) {
        empty.createDiv({
          cls: "smart-todo-empty-scope",
          text: `Watching ${describeScope(this.plugin.scope)}`,
        });
      }
      return;
    }

    for (const task of tasks) {
      this.renderRow(this.listEl, task, today);
    }
  }

  private renderRow(parent: HTMLElement, task: SmartTask, today: Date): void {
    const row = parent.createDiv({ cls: "smart-todo-row" });
    if (task.status === "done") row.addClass("is-done");
    if (task.due && task.due.getTime() < today.getTime() && task.status === "open") {
      row.addClass("is-overdue");
    }
    if (isResting(task, today)) row.addClass("is-resting");

    const checkbox = row.createEl("input", {
      cls: "smart-todo-checkbox",
      attr: { type: "checkbox" },
    }) as HTMLInputElement;
    checkbox.checked = task.status === "done";
    checkbox.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      checkbox.disabled = true;
      const ok = await safeWrite(() =>
        toggleTaskDone(this.app, task, task.status === "open")
      );
      if (!ok) checkbox.checked = task.status === "done";
      await this.refresh();
    });

    const main = row.createDiv({ cls: "smart-todo-main" });

    const titleEl = main.createDiv({
      cls: "smart-todo-title",
      text: task.title || "(untitled task)",
    });
    titleEl.addEventListener("click", () => void this.revealTask(task));
    titleEl.setAttr("title", `${task.filePath}:${task.lineNumber + 1}`);

    const meta = main.createDiv({ cls: "smart-todo-meta" });

    if (task.due) {
      meta.createSpan({
        cls: "smart-todo-date",
        text: this.humanDate(task.due, today),
      });
    }

    if (isResting(task, today)) {
      meta.createSpan({
        cls: "smart-todo-date is-defer",
        text: `rests until ${this.humanDate(task.defer, today)}`,
      });
    }

    if (task.effort) {
      const pill = meta.createSpan({
        cls: `smart-todo-effort is-${task.effort}`,
        text: task.effort.charAt(0).toUpperCase() + task.effort.slice(1),
      });
      // Right-click to retag effort — the field you most often get wrong first.
      pill.addEventListener("contextmenu", (evt) => {
        evt.preventDefault();
        this.showEffortMenu(evt, task);
      });
    }

    if (task.pushes > 0) {
      meta.createSpan({
        cls: "smart-todo-pushes",
        text: `↻ ${task.pushes}`,
        attr: {
          "aria-label": `Pushed ${task.pushes} ${task.pushes === 1 ? "time" : "times"}`,
        },
      });
    }

    if (task.project) {
      meta.createSpan({ cls: "smart-todo-project", text: task.project });
    }

    if (task.assigned) {
      meta.createSpan({ cls: "smart-todo-assigned", text: `@${task.assigned}` });
    }

    if (task.status === "done" && task.doneDate) {
      meta.createSpan({
        cls: "smart-todo-date",
        text: `done ${formatDate(task.doneDate)}`,
      });
    }

    if (task.status === "open") {
      const pushBtn = row.createEl("button", {
        cls: "smart-todo-push",
        attr: { "aria-label": "Push 1 day" },
      });
      setIcon(pushBtn, "chevrons-right");
      pushBtn.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        pushBtn.disabled = true;
        await safeWrite(() => pushTask(this.app, task, 1));
        await this.refresh();
      });
    }
  }

  private showEffortMenu(evt: MouseEvent, task: SmartTask): void {
    const menu = new Menu();
    for (const effort of EFFORTS) {
      menu.addItem((item) =>
        item
          .setTitle(effort.charAt(0).toUpperCase() + effort.slice(1))
          .setChecked(task.effort === effort)
          .onClick(async () => {
            await safeWrite(() => setTaskEffort(this.app, task, effort as Effort));
            await this.refresh();
          })
      );
    }
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Clear effort").onClick(async () => {
        await safeWrite(() => setTaskEffort(this.app, task, null));
        await this.refresh();
      })
    );
    menu.showAtMouseEvent(evt);
  }

  /** Open the source note and park the cursor on the task's line. */
  private async revealTask(task: SmartTask): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(
      this.app.vault.getAbstractFileByPath(task.filePath) as any,
      { eState: { line: task.lineNumber } }
    );
  }

  private humanDate(date: Date, today: Date): string {
    if (!date) return "";
    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, addDays(today, 1))) return "Tomorrow";
    if (isSameDay(date, addDays(today, -1))) return "Yesterday";
    const days = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (days < 0) return `${formatDate(date)} (${Math.abs(days)}d late)`;
    if (days <= 6) {
      return date.toLocaleDateString(undefined, { weekday: "short" });
    }
    return formatDate(date);
  }
}
