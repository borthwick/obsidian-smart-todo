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
  EFFORTS,
  EFFORT_WEIGHT,
  Effort,
  Layout,
  QUADRANTS,
  QUAD_FILTERS,
  QUADRANT_COLOR,
  QuadFilterId,
  Quadrant,
  SmartTask,
  SortKey,
  SortState,
  TABS,
  TabId,
  VIEW_TYPE_SMART_TODO,
  projectColor,
} from "./types";
import {
  pushTask,
  safeWrite,
  setTaskEffort,
  setTaskImportant,
  setTaskProject,
  toggleTaskDone,
} from "./writer";
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
        this.renderQuadFilters();
        this.render();
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
    } else {
      for (const task of ordered) {
        this.renderRow(this.listEl, task, today);
      }
    }
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
    titleEl.addEventListener("click", () => void this.revealTask(task));
    titleEl.setAttr("title", `${task.filePath}:${task.lineNumber + 1}`);

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

    // Always render an effort pill — even when unset — so effort can be set
    // from scratch, not only retagged. An unset task has no pill to right-click,
    // which left you with no way in. Left-click (or right-click) opens the menu.
    const effortLabel = task.effort
      ? task.effort.charAt(0).toUpperCase() + task.effort.slice(1)
      : "Effort";
    const pill = meta.createSpan({
      cls: `smart-todo-effort is-${task.effort ?? "unset"}`,
      text: effortLabel,
      attr: { "aria-label": "Set effort" },
    });
    const openMenu = (evt: MouseEvent): void => {
      evt.preventDefault();
      evt.stopPropagation();
      this.showEffortMenu(evt, task);
    };
    pill.addEventListener("click", openMenu);
    pill.addEventListener("contextmenu", openMenu);

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

    this.renderProject(meta, task);

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
   * Project chip: a colored dot + name, or a faint "+ Project" affordance when
   * unset. Click either to set/change — a project needs to be settable from the
   * panel, not just from markdown.
   */
  private renderProject(parent: HTMLElement, task: SmartTask): void {
    const chip = parent.createSpan({ cls: "smart-todo-project" });
    if (task.project) {
      chip.createSpan({
        cls: "smart-todo-project-dot",
        attr: { style: `background:${projectColor(task.project)}` },
      });
      chip.createSpan({ cls: "smart-todo-project-name", text: task.project });
    } else {
      chip.addClass("is-unset");
      chip.setText("+ Project");
    }
    chip.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.promptProject(task);
    });
  }

  private promptProject(task: SmartTask): void {
    const known = Array.from(
      new Set(this.tasks.map((t) => t.project).filter((p): p is string => !!p))
    ).sort();
    new ProjectPromptModal(this.app, task.project ?? "", known, async (value) => {
      await safeWrite(() =>
        setTaskProject(this.app, task, value.trim() || null)
      );
      await this.refresh();
    }).open();
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
      titleSpan.addEventListener("click", () => void this.revealTask(task));

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

      // Effort
      const effTd = tr.createEl("td", { cls: "smart-todo-td-effort" });
      const effLabel = task.effort
        ? task.effort.charAt(0).toUpperCase() + task.effort.slice(1)
        : "—";
      const effPill = effTd.createSpan({
        cls: `smart-todo-effort is-${task.effort ?? "unset"}`,
        text: effLabel,
      });
      effPill.addEventListener("click", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        this.showEffortMenu(evt, task);
      });

      // Project
      const projTd = tr.createEl("td", { cls: "smart-todo-td-project" });
      this.renderProject(projTd, task);
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

/**
 * Minimal project picker: a text field prefilled with the current value, plus
 * one-click chips for projects already used elsewhere in scope so you reuse
 * names instead of spawning near-duplicates.
 */
class ProjectPromptModal extends Modal {
  constructor(
    app: import("obsidian").App,
    private current: string,
    private known: string[],
    private onSubmit: (value: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Set project" });

    const input = contentEl.createEl("input", {
      cls: "smart-todo-project-input",
      attr: { type: "text", placeholder: "Project name (blank to clear)" },
    }) as HTMLInputElement;
    input.value = this.current;
    input.focus();
    input.select();

    const submit = (): void => {
      this.onSubmit(input.value);
      this.close();
    };
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        submit();
      } else if (evt.key === "Escape") {
        this.close();
      }
    });

    if (this.known.length > 0) {
      const chips = contentEl.createDiv({ cls: "smart-todo-project-chips" });
      for (const name of this.known) {
        const chip = chips.createEl("button", {
          cls: "smart-todo-project-chip",
          text: name,
        });
        chip.createSpan({
          cls: "smart-todo-project-dot",
          attr: { style: `background:${projectColor(name)}` },
        });
        chip.addEventListener("click", () => {
          input.value = name;
          submit();
        });
      }
    }

    const actions = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
    const ok = actions.createEl("button", { cls: "mod-cta", text: "Set" });
    ok.addEventListener("click", submit);
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
