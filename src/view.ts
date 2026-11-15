// Smart ToDo — Today view (right-leaf ItemView).

import { ItemView, Menu, Modal, WorkspaceLeaf, setIcon } from "obsidian";
import {
  bucketFor,
  isResting,
  isUnjudged,
  isUrgent,
  quadrantOf,
} from "./filters";
import { addDays, formatDate, isSameDay, startOfToday } from "./parser";
import { describeScope } from "./scope";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  Category,
  EFFORTS,
  EFFORT_LABEL,
  EFFORT_WEIGHT,
  Effort,
  Layout,
  QUADRANTS,
  QUAD_FILTERS,
  QUADRANT_COLOR,
  QUICKIE_HEADING,
  QuadFilterId,
  Quadrant,
  SmartTask,
  SortKey,
  SortState,
  TABS,
  TabId,
  VIEW_TYPE_SMART_TODO,
  asCategory,
  projectColor,
} from "./types";
import {
  TaskPatch,
  applyTaskPatch,
  pushTask,
  safeWrite,
  setTaskEffort,
  setTaskImportant,
  setTaskProject,
  toggleTaskDone,
} from "./writer";
import { EditTaskModal } from "./edit-task-modal";
import type SmartTodoPlugin from "./main";

export class SmartTodoView extends ItemView {
  plugin: SmartTodoPlugin;
  activeTab: TabId = "today";
  activeQuad: QuadFilterId = "all";
  matrixView = false;
  tasks: SmartTask[] = [];
  loading = false;
  layout: Layout = "card";
  sort: SortState | null = null;

  private tabBarEl: HTMLElement;
  private quadBarEl: HTMLElement;
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
    this.layout = this.plugin.settings.defaultLayout;

    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("smart-todo-root");

    const header = root.createDiv({ cls: "smart-todo-header" });
    this.tabBarEl = header.createDiv({ cls: "smart-todo-tabs" });

    const actions = header.createDiv({ cls: "smart-todo-header-actions" });

    // Matrix toggle: flip the list for a 2×2 Eisenhower grid of the same set.
    const matrixBtn = actions.createEl("button", {
      cls: "smart-todo-matrix-toggle",
      attr: { "aria-label": "Toggle Eisenhower matrix" },
    });
    const paintMatrixBtn = (): void => {
      setIcon(matrixBtn, "layout-grid");
      matrixBtn.toggleClass("is-active", this.matrixView);
    };
    paintMatrixBtn();
    matrixBtn.addEventListener("click", () => {
      this.matrixView = !this.matrixView;
      paintMatrixBtn();
      this.render();
    });

    const layoutBtn = actions.createEl("button", {
      cls: "smart-todo-layout-toggle",
      attr: { "aria-label": "Toggle card / table layout" },
    });
    const paintLayoutBtn = (): void =>
      setIcon(layoutBtn, this.layout === "table" ? "list" : "table");
    paintLayoutBtn();
    layoutBtn.addEventListener("click", () => {
      this.layout = this.layout === "table" ? "card" : "table";
      paintLayoutBtn();
      this.render();
    });

    const refreshBtn = actions.createEl("button", {
      cls: "smart-todo-refresh",
      attr: { "aria-label": "Rescan vault" },
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => void this.refresh());

    // Eisenhower filter buttons — the second filter axis, below the tabs.
    this.quadBarEl = root.createDiv({ cls: "smart-todo-quadbar" });

    this.renderAddRow(root);

    this.summaryEl = root.createDiv({ cls: "smart-todo-summary" });
    this.listEl = root.createDiv({ cls: "smart-todo-list" });

    this.renderTabs();
    this.renderQuadFilters();
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
    this.renderQuadFilters();
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
        // Rescan, don't just repaint from memory. Switching tabs is the moment
        // you most expect to see a task you just added — repainting a stale
        // `this.tasks` is what made a new "tomorrow" task missing from the
        // Tomorrow tab until something else triggered a refresh.
        void this.refresh();
      });
    }
  }

  /**
   * The Eisenhower filter row. Each button carries a live count of how many
   * open tasks in the current tab land in that slice — so the bar doubles as a
   * matrix review: you can see at a glance that "Urgent & Important" is 9 and
   * "Needs review" is 40 without clicking anything.
   */
  private renderQuadFilters(): void {
    if (!this.quadBarEl) return;
    this.quadBarEl.empty();
    const today = startOfToday();

    // Count against the current tab's open set, ignoring the active quad filter
    // (so the counts don't collapse to the one button you've selected).
    const tabSet = bucketFor(this.tasks, this.activeTab, today, "all").tasks;

    for (const f of QUAD_FILTERS) {
      const count =
        f.id === "all"
          ? tabSet.length
          : tabSet.filter((t) => this.quadFilterMatch(t, f.id, today)).length;

      const btn = this.quadBarEl.createEl("button", {
        cls: "smart-todo-quad-btn",
      });
      btn.createSpan({ cls: "smart-todo-quad-label", text: f.label });
      btn.createSpan({ cls: "smart-todo-quad-count", text: String(count) });

      if (f.id === this.activeQuad) btn.addClass("is-active");
      if (count === 0 && f.id !== "all") btn.addClass("is-empty");

      btn.addEventListener("click", () => {
        this.activeQuad = f.id;
        this.renderQuadFilters();
        this.render();
      });
    }
  }

  /** Thin wrapper so the view doesn't re-import the predicate guts. */
  private quadFilterMatch(task: SmartTask, id: QuadFilterId, today: Date): boolean {
    // Mirror matchesQuadFilter without importing it everywhere; the counts
    // row needs the same logic the bucket uses.
    const urgent = isUrgent(task, today);
    const important = task.important === true;
    const unjudged = isUnjudged(task);
    switch (id) {
      case "do": return urgent && important;
      case "schedule": return !urgent && important;
      case "delegate": return urgent && !important;
      case "drop": return !urgent && !important && !unjudged;
      case "urgent": return urgent;
      case "important": return important;
      case "unjudged": return unjudged;
      default: return true;
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

    // In matrix view the 2×2 grid is the filter, so ignore the active quad
    // button and show the whole tab set laid out by quadrant.
    const quad = this.matrixView ? "all" : this.activeQuad;
    const { tasks, restingCount } = bucketFor(
      this.tasks,
      this.activeTab,
      today,
      quad
    );

    const countLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
    this.summaryEl.createSpan({ cls: "smart-todo-count", text: countLabel });
    if (!this.matrixView && this.activeQuad !== "all") {
      const def = QUAD_FILTERS.find((f) => f.id === this.activeQuad);
      if (def) {
        this.summaryEl.createSpan({
          cls: "smart-todo-filter-tag",
          text: `· ${def.label}`,
        });
      }
    }

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

    const ordered = this.applySort(tasks, today);

    if (this.matrixView) {
      this.renderMatrix(this.listEl, ordered, today);
    } else if (this.layout === "table") {
      this.renderTable(this.listEl, ordered, today);
    } else if (this.quickiesGrouped()) {
      this.renderGroupedCards(this.listEl, ordered, today);
    } else {
      for (const task of ordered) {
        this.renderRow(this.listEl, task, today);
      }
    }
  }

  /**
   * Card list with light-effort tasks pulled out into their own section at the
   * foot: "Quickies · 3 minutes or less".
   *
   * The real work and the five-things-you-can-knock-off-now are different
   * decisions, and interleaving them meant the quick ones padded the list and
   * made Today look worse than it was. Separating them also gives the batch a
   * name — "do the quickies" is a thing you can actually act on.
   */
  private renderGroupedCards(
    parent: HTMLElement,
    tasks: SmartTask[],
    today: Date
  ): void {
    const quickies = tasks.filter((t) => t.effort === "light");
    const rest = tasks.filter((t) => t.effort !== "light");

    for (const task of rest) this.renderRow(parent, task, today);

    if (quickies.length === 0) return;

    // Only label the section when there's something above it to distinguish
    // it from — an all-quickies list doesn't need a header saying so.
    if (rest.length > 0) {
      const head = parent.createDiv({ cls: "smart-todo-group-head" });
      head.createSpan({ cls: "smart-todo-group-title", text: QUICKIE_HEADING });
      head.createSpan({
        cls: "smart-todo-group-tally",
        text: String(quickies.length),
      });
    }
    const body = parent.createDiv({ cls: "smart-todo-group-body" });
    for (const task of quickies) this.renderRow(body, task, today);
  }

  /**
   * The 2×2 Eisenhower grid: four quadrant cells, each holding the compact
   * rows that fall in it. Urgent on the left column, Important on the top row,
   * so Q1 (Do) sits top-left where the eye lands first.
   */
  private renderMatrix(parent: HTMLElement, tasks: SmartTask[], today: Date): void {
    const grid = parent.createDiv({ cls: "smart-todo-matrix" });

    const byQuad: Record<Quadrant, SmartTask[]> = {
      do: [],
      schedule: [],
      delegate: [],
      drop: [],
    };
    for (const t of tasks) byQuad[quadrantOf(t, today)].push(t);

    // Grid order: top-left Do, top-right Schedule, bottom-left Delegate,
    // bottom-right Drop — the canonical layout.
    const order: Quadrant[] = ["do", "schedule", "delegate", "drop"];
    for (const q of order) {
      const def = QUADRANTS.find((d) => d.id === q)!;
      const cell = grid.createDiv({ cls: `smart-todo-quad-cell is-${q}` });
      cell.style.setProperty("--quad-color", QUADRANT_COLOR[q]);

      const head = cell.createDiv({ cls: "smart-todo-quad-head" });
      head.createSpan({ cls: "smart-todo-quad-title", text: def.label });
      head.createSpan({
        cls: "smart-todo-quad-advice",
        text: def.advice,
      });
      head.createSpan({
        cls: "smart-todo-quad-tally",
        text: String(byQuad[q].length),
      });

      const body = cell.createDiv({ cls: "smart-todo-quad-body" });
      if (byQuad[q].length === 0) {
        body.createDiv({ cls: "smart-todo-quad-empty", text: "—" });
        continue;
      }
      for (const task of byQuad[q]) {
        this.renderRow(body, task, today);
      }
    }
  }

  /**
   * In table layout the user drives the sort via column headers. In card layout
   * (or table with no explicit sort chosen) we keep the smart triage order the
   * bucket already produced.
   */
  private applySort(tasks: SmartTask[], today: Date): SmartTask[] {
    if (this.layout !== "table" || !this.sort) return tasks;
    const { key, dir } = this.sort;
    const mul = dir === "asc" ? 1 : -1;
    // Quadrant priority for sorting: Do first, then Schedule, Delegate, Drop.
    const quadRank: Record<Quadrant, number> = {
      do: 0,
      schedule: 1,
      delegate: 2,
      drop: 3,
    };
    const val = (t: SmartTask): number | string => {
      switch (key) {
        case "due":
          return t.due ? t.due.getTime() : Number.POSITIVE_INFINITY;
        case "pushes":
          return t.pushes;
        case "effort":
          return t.effort ? EFFORT_WEIGHT[t.effort] : 0;
        case "project":
          return (t.project ?? "").toLowerCase();
        case "quadrant":
          return quadRank[quadrantOf(t, today)];
        default:
          return t.title.toLowerCase();
      }
    };
    return [...tasks].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
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

    const titleRow = main.createDiv({ cls: "smart-todo-title-row" });

    // Importance star, left of the title: filled = important, hollow = not,
    // faint "?" = unjudged. Click cycles unjudged → important → not → unjudged
    // so the whole matrix can be set without leaving the panel.
    this.renderImportanceToggle(titleRow, task);

    const titleEl = titleRow.createDiv({
      cls: "smart-todo-title",
      text: task.title || "(untitled task)",
    });
    // Click edits. Reaching the markdown is still one click away (the editor's
    // "Open in note"), but editing in place is the common case and used to be
    // the impossible one.
    titleEl.addEventListener("click", () => this.openEditor(task));
    titleEl.setAttr("title", "Click to edit · " + `${task.filePath}:${task.lineNumber + 1}`);

    const meta = main.createDiv({ cls: "smart-todo-meta" });

    // Quadrant pill: the live Eisenhower classification. Colored by quadrant,
    // labelled with the verb (Do / Schedule / Delegate / Drop). Read-only — it
    // reflects urgency (from the date) × importance (the star), both set
    // elsewhere, so it's a result, not another control to fiddle with.
    if (task.status === "open") {
      const q = quadrantOf(task, today);
      const def = QUADRANTS.find((d) => d.id === q)!;
      const qpill = meta.createSpan({
        cls: `smart-todo-quadpill is-${q}`,
        text: def.label,
        attr: { "aria-label": `${def.label} — ${def.advice}` },
      });
      qpill.style.setProperty("--quad-color", QUADRANT_COLOR[q]);
      if (isUnjudged(task)) qpill.addClass("is-unjudged");
    }

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

    // Effort is tagged on everything but only Quickies get a pill. A
    // Moderate/Heavy badge on every row was decoration — it never changed what
    // you did next. "3 minutes or less" does. Moderate/Heavy are still set and
    // changed from the editor, and still drive sort order.
    // When quickie grouping is on, the section header already says it, so the
    // pill would be saying it twice.
    if (task.effort === "light" && !this.quickiesGrouped()) {
      const pill = meta.createSpan({
        cls: "smart-todo-effort is-light",
        text: EFFORT_LABEL.light,
        attr: { "aria-label": "3 minutes or less" },
      });
      const openMenu = (evt: MouseEvent): void => {
        evt.preventDefault();
        evt.stopPropagation();
        this.showEffortMenu(evt, task);
      };
      pill.addEventListener("click", openMenu);
      pill.addEventListener("contextmenu", openMenu);
    }

    if (task.pushes > 0) {
      const warn = task.pushes >= this.plugin.settings.pushesWarnThreshold;
      meta.createSpan({
        cls: `smart-todo-pushes${warn ? " is-warn" : ""}`,
        text: `↻ ${task.pushes}`,
        attr: {
          "aria-label": `Pushed ${task.pushes} ${task.pushes === 1 ? "time" : "times"}`,
        },
      });
    }

    this.renderCategory(meta, task);

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

  /**
   * Importance star. Three states cycle on click:
   *   unjudged (?) → important (★) → not important (☆) → unjudged
   * Right-click clears straight back to unjudged. This is the one control that
   * sets the "important" axis; urgency is never set by hand.
   */
  private renderImportanceToggle(parent: HTMLElement, task: SmartTask): void {
    const state =
      task.important === true ? "yes" : task.important === false ? "no" : "unjudged";
    const star = parent.createSpan({
      cls: `smart-todo-star is-${state}`,
      attr: {
        "aria-label":
          state === "yes"
            ? "Important — click to mark not important"
            : state === "no"
              ? "Not important — click to clear"
              : "Importance not set — click to mark important",
      },
    });
    setIcon(star, state === "yes" ? "star" : state === "no" ? "star-off" : "help-circle");

    const cycle = async (): Promise<void> => {
      const next = task.important === null ? true : task.important === true ? false : null;
      await safeWrite(() => setTaskImportant(this.app, task, next));
      await this.refresh();
    };
    star.addEventListener("click", (evt) => {
      evt.stopPropagation();
      void cycle();
    });
    star.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void safeWrite(() => setTaskImportant(this.app, task, null)).then(() =>
        this.refresh()
      );
    });
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

  /**
   * Category chip: a colored dot + name, or a faint "+ Category" affordance
   * when unset. Click opens a three-item menu — Betaworks / Personal / Health
   * — because the whole point of collapsing eleven free-text projects into
   * three categories is that picking one should never need typing.
   *
   * A legacy, un-migrated value still renders under its own hashed color so
   * it's visibly *not* one of the three until it's folded.
   */
  private renderCategory(parent: HTMLElement, task: SmartTask): void {
    const chip = parent.createSpan({ cls: "smart-todo-project" });
    const canonical = asCategory(task.project);

    if (canonical) {
      chip.createSpan({
        cls: "smart-todo-project-dot",
        attr: { style: `background:${CATEGORY_COLOR[canonical]}` },
      });
      chip.createSpan({
        cls: "smart-todo-project-name",
        text: CATEGORY_LABEL[canonical],
      });
    } else if (task.project) {
      chip.addClass("is-legacy");
      chip.createSpan({
        cls: "smart-todo-project-dot",
        attr: { style: `background:${projectColor(task.project)}` },
      });
      chip.createSpan({ cls: "smart-todo-project-name", text: task.project });
      chip.setAttr("aria-label", "Not one of the three categories — click to set");
    } else {
      chip.addClass("is-unset");
      chip.setText("+ Category");
    }

    chip.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.showCategoryMenu(evt as MouseEvent, task);
    });
  }

  private showCategoryMenu(evt: MouseEvent, task: SmartTask): void {
    const current = asCategory(task.project);
    const menu = new Menu();
    for (const cat of CATEGORIES) {
      menu.addItem((item) =>
        item
          .setTitle(CATEGORY_LABEL[cat])
          .setChecked(current === cat)
          .onClick(async () => {
            await safeWrite(() => setTaskProject(this.app, task, cat as Category));
            await this.refresh();
          })
      );
    }
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Clear category").onClick(async () => {
        await safeWrite(() => setTaskProject(this.app, task, null));
        await this.refresh();
      })
    );
    menu.showAtMouseEvent(evt);
  }

  /** Open the full editor for a task and write back whatever changed. */
  private openEditor(task: SmartTask): void {
    new EditTaskModal(
      this.app,
      task,
      async (patch: TaskPatch) => {
        if (Object.keys(patch).length === 0) return;
        await safeWrite(() => applyTaskPatch(this.app, task, patch));
        await this.refresh();
      },
      () => void this.revealTask(task)
    ).open();
  }

  /** Is the Quickies section active for the current layout? */
  private quickiesGrouped(): boolean {
    return (
      this.plugin.settings.groupQuickies &&
      this.layout === "card" &&
      !this.matrixView
    );
  }

  /** Onda-style table: sortable headers + one row per task. */
  private renderTable(parent: HTMLElement, tasks: SmartTask[], today: Date): void {
    const table = parent.createEl("table", { cls: "smart-todo-table" });
    const thead = table.createEl("thead");
    const headRow = thead.createEl("tr");

    const cols: Array<{ key: SortKey; label: string }> = [
      { key: "title", label: "Task" },
      { key: "quadrant", label: "Priority" },
      { key: "due", label: "Due" },
      { key: "pushes", label: "Pushes" },
      { key: "effort", label: "Effort" },
      { key: "project", label: "Project" },
    ];
    for (const col of cols) {
      const th = headRow.createEl("th", { cls: "smart-todo-th", text: col.label });
      if (this.sort?.key === col.key) {
        th.addClass("is-sorted");
        th.createSpan({
          cls: "smart-todo-sort-caret",
          text: this.sort.dir === "asc" ? " ▲" : " ▼",
        });
      }
      th.addEventListener("click", () => {
        if (this.sort?.key === col.key) {
          this.sort = {
            key: col.key,
            dir: this.sort.dir === "asc" ? "desc" : "asc",
          };
        } else {
          this.sort = { key: col.key, dir: "asc" };
        }
        this.render();
      });
    }

    const tbody = table.createEl("tbody");
    for (const task of tasks) {
      const tr = tbody.createEl("tr", { cls: "smart-todo-trow" });
      if (task.status === "done") tr.addClass("is-done");
      if (task.due && task.due.getTime() < today.getTime() && task.status === "open") {
        tr.addClass("is-overdue");
      }

      // Task cell: checkbox + title
      const titleTd = tr.createEl("td", { cls: "smart-todo-td-title" });
      const cb = titleTd.createEl("input", {
        attr: { type: "checkbox" },
        cls: "smart-todo-checkbox",
      }) as HTMLInputElement;
      cb.checked = task.status === "done";
      cb.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        cb.disabled = true;
        await safeWrite(() =>
          toggleTaskDone(this.app, task, task.status === "open")
        );
        await this.refresh();
      });
      const titleSpan = titleTd.createSpan({
        cls: "smart-todo-title",
        text: task.title || "(untitled task)",
      });
      titleSpan.addEventListener("click", () => this.openEditor(task));

      // Priority: importance star + quadrant pill
      const quadTd = tr.createEl("td", { cls: "smart-todo-td-quadrant" });
      this.renderImportanceToggle(quadTd, task);
      if (task.status === "open") {
        const q = quadrantOf(task, today);
        const def = QUADRANTS.find((d) => d.id === q)!;
        const qpill = quadTd.createSpan({
          cls: `smart-todo-quadpill is-${q}`,
          text: def.label,
          attr: { "aria-label": def.advice },
        });
        qpill.style.setProperty("--quad-color", QUADRANT_COLOR[q]);
        if (isUnjudged(task)) qpill.addClass("is-unjudged");
      } else {
        quadTd.createSpan({ cls: "smart-todo-quad-na", text: "—" });
      }

      // Due
      const dueTd = tr.createEl("td", { cls: "smart-todo-td-due" });
      dueTd.setText(task.due ? this.humanDate(task.due, today) : "—");

      // Pushes
      const pushTd = tr.createEl("td", { cls: "smart-todo-td-pushes" });
      if (task.pushes > 0) {
        const warn = task.pushes >= this.plugin.settings.pushesWarnThreshold;
        pushTd.createSpan({
          cls: `smart-todo-pushes${warn ? " is-warn" : ""}`,
          text: String(task.pushes),
        });
      } else {
        pushTd.setText("—");
      }

      // Effort — Quickie only, same rule as the card rows. The column stays so
      // the table can still be sorted by effort, it just doesn't print a badge
      // for Moderate/Heavy.
      const effTd = tr.createEl("td", { cls: "smart-todo-td-effort" });
      if (task.effort === "light") {
        const effPill = effTd.createSpan({
          cls: "smart-todo-effort is-light",
          text: EFFORT_LABEL.light,
        });
        effPill.addEventListener("click", (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          this.showEffortMenu(evt, task);
        });
      } else {
        effTd.setText("—");
      }

      // Category
      const projTd = tr.createEl("td", { cls: "smart-todo-td-project" });
      this.renderCategory(projTd, task);
    }
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
