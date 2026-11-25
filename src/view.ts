// Smart ToDo — the sidebar panel (right-leaf ItemView).
//
// 0.8 rebuild. The shape comes from a round of mockups, and the thing they
// settled was not "which layout" but *what kind of control each axis is*:
//
//   category (work / personal / health) — a FILTER
//   time budget (3 min / 15 min / 1 hour) — a FILTER
//   Eisenhower quadrant — the GROUPING
//
// 0.7 treated all three as views, which is why it ended up with seven tabs, an
// eight-button quadrant bar, a matrix toggle and a layout toggle, and why no
// combination of them answered "what should I do right now". Two filter rows
// over one grouped list answers it, and everything else is a mode:
//
//   Focus — the list, grouped Do first / Schedule / Delegate / Drop
//   Sweep — only what fits the budget, run on a timer (see sweep-modal.ts)
//   Lanes — the same set split into effort columns
//
// Rows are shared across all three, so a task looks and behaves identically
// wherever you meet it.

import { ItemView, Menu, Notice, WorkspaceLeaf, setIcon, setTooltip } from "obsidian";
import {
  PanelQuery,
  SourceGroup,
  estimateMinutes,
  fitsBudget,
  formatDuration,
  groupByHeading,
  groupBySource,
  groupByQuadrant,
  isContainer,
  isParked,
  isResting,
  isUnjudged,
  matchesCategory,
  matchesHorizon,
  matchesSearch,
  quadrantOf,
  selectTasks,
} from "./filters";
import { addDays, displayTitle, formatDate, isSameDay, startOfToday } from "./parser";
import { describeScope, samePath } from "./scope";
import {
  BUDGETS,
  Budget,
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  Category,
  CategoryFilter,
  EFFORTS,
  EFFORT_BLURB,
  EFFORT_LABEL,
  EFFORT_MINUTES,
  Effort,
  HORIZONS,
  Horizon,
  MODES,
  PRIORITY_MARK,
  QUADRANTS,
  QUADRANT_COLOR,
  QUADRANT_ORDER,
  Quadrant,
  SmartTask,
  VIEW_TYPE_SMART_TODO,
  ViewMode,
  applyAccentVars,
  asCategory,
  projectColor,
} from "./types";
import {
  TaskPatch,
  applyTaskPatch,
  buildPatchedLine,
  dropTask,
  moveTaskLine,
  pushTargetDate,
  pushTask,
  safeWrite,
  setTaskEffort,
  setTaskImportant,
  setTaskProject,
  toggleTaskDone,
} from "./writer";
import { EditTaskModal } from "./edit-task-modal";
import { SweepModal } from "./sweep-modal";
import { QuickAction, QuickSwitchModal } from "./quick-switch";
import { SPIRAL_ICON_ID } from "./task-suggest";
import type SmartTodoPlugin from "./main";

export class SmartTodoView extends ItemView {
  plugin: SmartTodoPlugin;

  mode: ViewMode = "focus";
  horizon: Horizon = "today";
  budget: Budget = "any";
  category: CategoryFilter = "all";
  search = "";
  /** Set by "Search all tasks" in the empty state; cleared with the search box. */
  searchEverywhere = false;

  tasks: SmartTask[] = [];
  loading = false;
  /** Inbox bucket expanded? Collapsed is a legitimate "not now", not a hide. */
  inboxOpen = true;

  private filtersEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private searchInputEl!: HTMLInputElement;

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
    return SPIRAL_ICON_ID;
  }

  async onOpen(): Promise<void> {
    this.mode = this.plugin.settings.defaultMode;

    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("smart-todo-root");
    this.applyAccent(root);

    this.renderTitleBar(root);
    this.renderSearch(root);
    this.filtersEl = root.createDiv({ cls: "stw-filters" });
    this.bodyEl = root.createDiv({ cls: "stw-body" });

    this.renderFilters();
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.containerEl.children[1]?.empty();
  }

  /**
   * Accent lives in CSS custom properties so one setting repaints everything.
   * Set here *and* on document.body by the plugin — the panel keeps working if
   * something resets body, and modals (mounted outside this tree) inherit.
   */
  private applyAccent(root: HTMLElement): void {
    applyAccentVars(root, this.plugin.settings.accent);
  }

  /** Repaint from scratch — used when a setting changes shape, not just data. */
  rebuild(): void {
    void this.onOpen();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.render();
    this.tasks = await this.plugin.scan();
    this.loading = false;
    this.renderFilters();
    this.render();
  }

  // --- Header --------------------------------------------------------------

  private renderTitleBar(root: HTMLElement): void {
    const bar = root.createDiv({ cls: "stw-titlebar" });

    const brand = bar.createDiv({ cls: "stw-brand" });
    const mark = brand.createSpan({ cls: "stw-mark" });
    setIcon(mark, "check");
    brand.createSpan({ cls: "stw-brand-name", text: "Smart ToDo" });

    bar.createSpan({
      cls: "stw-date",
      text: new Date().toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    });

    const refresh = bar.createEl("button", {
      cls: "stw-icon-btn",
      attr: { "aria-label": "Rescan vault" },
    });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.refresh());

    const add = bar.createEl("button", {
      cls: "stw-icon-btn is-primary",
      attr: { "aria-label": "Add task" },
    });
    setIcon(add, "plus");
    add.addEventListener("click", () => this.focusCapture());
  }

  /**
   * Search box. Typing filters the list live; ⌘K (or clicking the hint) opens
   * the palette, which can set any filter *or* jump to a task. Both write the
   * same state, so the chips below always reflect what the box did.
   */
  private renderSearch(root: HTMLElement): void {
    const wrap = root.createDiv({ cls: "stw-search" });
    const icon = wrap.createSpan({ cls: "stw-search-icon" });
    setIcon(icon, "search");

    this.searchInputEl = wrap.createEl("input", {
      cls: "stw-search-input",
      attr: { type: "text", placeholder: "work, quick, do first…" },
    }) as HTMLInputElement;

    // Clear button, between the input and the ⌘K hint. Escape already does
    // this, but only if the box has focus and only if you know — and the
    // keyboard isn't where you are when you've just read the result.
    const clear = wrap.createSpan({ cls: "stw-search-clear" });
    setIcon(clear, "x");
    clear.setAttribute("aria-label", "Clear search");
    const syncClear = () => clear.toggleClass("is-visible", this.search.length > 0);

    this.searchInputEl.addEventListener("input", () => {
      this.search = this.searchInputEl.value;
      // A new search starts scoped again. Carrying "everywhere" over to the
      // next word would silently disable the chips for the rest of the session.
      this.searchEverywhere = false;
      syncClear();
      this.renderFilters();
      this.render();
    });

    const clearSearch = (refocus: boolean) => {
      this.searchInputEl.value = "";
      this.search = "";
      this.searchEverywhere = false;
      syncClear();
      if (refocus) this.searchInputEl.focus();
      else this.searchInputEl.blur();
      this.renderFilters();
      this.render();
    };

    // Clearing leaves the caret in the box: clicking X nearly always means
    // "wrong search, try again", not "done searching".
    clear.addEventListener("click", (evt) => {
      evt.preventDefault();
      clearSearch(true);
    });

    this.searchInputEl.addEventListener("keydown", (evt) => {
      if (evt.key === "Escape") {
        clearSearch(false);
      } else if (evt.key === "Enter") {
        // Enter on a non-empty box with no matches is the capture path: the
        // fastest way to add a task is to look for it, not find it, and type.
        evt.preventDefault();
        void this.captureFromSearch();
      } else if (evt.key === "k" && (evt.metaKey || evt.ctrlKey)) {
        evt.preventDefault();
        this.openPalette();
      }
    });

    const kbd = wrap.createSpan({ cls: "stw-kbd", text: "⌘K" });
    kbd.addEventListener("click", () => this.openPalette());

    // The box survives re-renders with text in it (palette search, capture),
    // so set the initial state from `this.search` rather than assuming empty.
    this.searchInputEl.value = this.search;
    syncClear();
  }

  private focusCapture(): void {
    this.searchInputEl.focus();
    this.searchInputEl.select();
  }

  /**
   * Enter in the search box with text that matches nothing → create it.
   *
   * "Matches nothing" has to mean nothing *anywhere*, not nothing under the
   * current filters. Searching "gala" from Today finds no open dated task and
   * used to offer to create one — while three gala lines sat in the note, two
   * ticked and one undated. Pressing Enter there would have written a
   * duplicate of a task that already existed, which is the one thing a to-do
   * list must never do to you. So Enter reveals the match first; it only
   * captures when the vault really has nothing.
   */
  private async captureFromSearch(): Promise<void> {
    const value = this.searchInputEl.value.trim();
    if (!value) return;
    if (this.visibleTasks().length > 0) return; // it's a filter, not a capture
    if (matchesSearch(this.listTasks, value).length > 0) {
      this.showAllMatches();
      return;
    }
    const ok = await this.plugin.addTask(value);
    if (ok) {
      this.searchInputEl.value = "";
      this.search = "";
    }
    await this.refresh();
  }

  /**
   * Public so a command can open the palette without the panel being focused.
   * The command is the honest entry point — ⌘K only works while the panel has
   * focus, and a palette you can only reach from inside the thing it navigates
   * isn't much of a shortcut.
   */
  openPalette(): void {
    new QuickSwitchModal(this.app, this.tasks, (action) => this.applyAction(action)).open();
  }

  private applyAction(action: QuickAction): void {
    switch (action.kind) {
      case "mode":
        this.mode = action.mode;
        break;
      case "budget":
        this.budget = action.budget;
        break;
      case "category":
        this.category = action.category;
        break;
      case "horizon":
        this.horizon = action.horizon;
        break;
      case "search":
        this.search = action.text;
        this.searchInputEl.value = action.text;
        break;
      case "task":
        void this.revealTask(action.task);
        return;
    }
    this.renderFilters();
    this.render();
  }

  // --- Filter rows ---------------------------------------------------------

  private renderFilters(): void {
    if (!this.filtersEl) return;
    this.filtersEl.empty();

    this.renderModeRow();
    // Lanes ARE the budget axis — offering a budget chip there would be two
    // controls for one idea, and picking "3 min" would empty three columns.
    if (this.mode !== "lanes") this.renderBudgetRow();
    this.renderCategoryRow();
  }

  private renderModeRow(): void {
    // The capsule holds only the toggles. The When menu is a sibling, not a
    // segment — it used to sit inside the grey strip and read as a fourth mode.
    const row = this.filtersEl.createDiv({ cls: "stw-row stw-moderow" });
    const caps = row.createDiv({ cls: "stw-modes" });
    for (const m of MODES) {
      // Icon and count only. Three modes with their names spelled out ate the
      // width of a 280px sidebar and truncated to "Fo… Sw… La…", which is
      // worse than no label at all — the glyph was already doing the work.
      const btn = caps.createEl("button", { cls: "stw-mode" });
      setTooltip(btn, m.label, { placement: "bottom" });
      const ic = btn.createSpan({ cls: "stw-mode-icon" });
      setIcon(ic, m.icon);
      btn.createSpan({ cls: "stw-mode-count", text: String(this.countForMode(m.id)) });
      if (m.id === this.mode) btn.addClass("is-active");
      btn.addEventListener("click", () => {
        this.mode = m.id;
        this.renderFilters();
        this.render();
      });
    }

    // Hairline before the trailing control, the way the iOS segmented control
    // separates its view toggles from the thing that isn't one. Does the job
    // the old gap was doing, in less width.
    row.createDiv({ cls: "stw-row-divider" });

    // "When" — the seven old tabs, collapsed into one menu. Deliberately not a
    // pill: the pills to its left are toggles that commit on click, this one
    // opens a menu, and a control that behaves differently should look
    // different.
    const when = row.createEl("button", { cls: "stw-when" });
    setTooltip(when, "When", { placement: "bottom" });
    when.createSpan({
      text: HORIZONS.find((h) => h.id === this.horizon)?.label ?? "Today",
    });
    setIcon(when.createSpan({ cls: "stw-when-caret" }), "chevron-down");
    when.addEventListener("click", (evt) => {
      const menu = new Menu();
      for (const h of HORIZONS) {
        menu.addItem((item) =>
          item
            .setTitle(h.label)
            .setChecked(this.horizon === h.id)
            .onClick(() => {
              this.horizon = h.id;
              this.renderFilters();
              // Rescan, don't repaint from memory: switching horizon is the
              // moment you most expect to see a task you just added, and a
              // stale in-memory list is what made 0.6 feel broken.
              void this.refresh();
            })
        );
      }
      menu.showAtMouseEvent(evt as MouseEvent);
    });
  }

  /**
   * "I have…" — the budget row. Counts are live, so the row doubles as an
   * answer before you click: *10 things fit in three minutes* is itself the
   * useful fact.
   */
  private renderBudgetRow(): void {
    // No "I have…" caption: "3 min / 15 min / 1 hour" already says what the row
    // is, and the caption cost a whole line of a narrow panel to say it twice.
    const wrap = this.filtersEl.createDiv({ cls: "stw-budget-wrap" });
    const row = wrap.createDiv({ cls: "stw-row stw-budgets" });

    for (const b of BUDGETS) {
      // Count against horizon + category only — holding budget out keeps the
      // four numbers comparable instead of collapsing onto the active chip.
      const count = this.listTasks.filter(
        (t) =>
          matchesHorizon(t, this.horizon) &&
          matchesCategory(t, this.category) &&
          fitsBudget(t, b.id)
      ).length;

      const btn = row.createEl("button", { cls: "stw-budget" });
      btn.createSpan({ cls: "stw-budget-label", text: b.label });
      btn.createSpan({ cls: "stw-budget-count", text: String(count) });
      if (b.id === this.budget) btn.addClass("is-active");
      if (count === 0) btn.addClass("is-empty");
      btn.addEventListener("click", () => {
        this.budget = b.id;
        this.renderFilters();
        this.render();
      });
    }
  }

  private renderCategoryRow(): void {
    const row = this.filtersEl.createDiv({ cls: "stw-row stw-cats" });
    const chips: Array<{ id: CategoryFilter; label: string }> = [
      { id: "all", label: "All" },
      ...CATEGORIES.map((c) => ({ id: c as CategoryFilter, label: CATEGORY_LABEL[c] })),
    ];
    for (const c of chips) {
      const btn = row.createEl("button", { cls: "stw-cat", text: c.label });
      if (c.id === this.category) btn.addClass("is-active");
      if (c.id !== "all") {
        btn.style.setProperty("--cat-color", CATEGORY_COLOR[c.id as Category]);
        btn.addClass("has-color");
      }
      btn.addEventListener("click", () => {
        this.category = c.id;
        this.renderFilters();
        this.render();
      });
    }
  }

  // --- Selection -----------------------------------------------------------

  private get query(): PanelQuery {
    return {
      horizon: this.horizon,
      // Sweep is the budget made literal: whatever the budget says fits, this
      // is the run-through of it. Lanes show every size side by side.
      budget: this.mode === "lanes" ? "any" : this.budget,
      category: this.category,
      search: this.search,
      searchEverywhere: this.searchEverywhere,
    };
  }

  /** Drop the filters for the current search term and repaint. */
  private showAllMatches(): void {
    this.searchEverywhere = true;
    this.renderFilters();
    this.render();
  }

  /**
   * The working list: everything the panel's filters apply to.
   *
   * One rule, no exceptions: an *open* task in the inbox file appears in the
   * Inbox bucket and nowhere else. It's held out of the list, out of the mode
   * counts, out of the budget counts and out of a sweep, so a count can never
   * promise something the list below it doesn't show. Keep it and it joins
   * this set; drop it and it leaves as a completed line.
   */
  private get listTasks(): SmartTask[] {
    if (!this.plugin.inboxPath) return this.tasks;
    return this.tasks.filter((t) => !this.plugin.isInboxTask(t));
  }

  private visibleTasks(): SmartTask[] {
    return selectTasks(this.listTasks, this.query);
  }

  /**
   * The triage queue, oldest capture first.
   *
   * Deliberately not run through `selectTasks`: a capture usually has no date
   * and no effort, so every filter in the panel would hide it — which is
   * exactly how a voice note silently goes nowhere. Search is the one filter
   * that applies, because searching for something you just said and not
   * finding it would be worse.
   */
  private inboxTasks(): SmartTask[] {
    if (!this.plugin.inboxPath) return [];
    const needle = this.search.trim().toLowerCase();
    return this.tasks
      .filter((t) => this.plugin.isInboxTask(t))
      .filter((t) => !needle || t.title.toLowerCase().includes(needle))
      .sort((a, b) => a.lineNumber - b.lineNumber);
  }

  /** The number on each mode button — what that mode would show right now. */
  private countForMode(mode: ViewMode): number {
    const base = this.listTasks.filter(
      (t) => matchesHorizon(t, this.horizon) && matchesCategory(t, this.category)
    );
    if (mode === "lanes") {
      return new Set(base.filter((t) => t.effort).map((t) => t.effort)).size;
    }
    if (mode === "sweep") return base.filter((t) => fitsBudget(t, "3m")).length;
    return base.filter((t) => fitsBudget(t, this.budget)).length;
  }

  // --- Body ----------------------------------------------------------------

  private render(): void {
    if (!this.bodyEl) return;
    const today = startOfToday();
    this.bodyEl.empty();

    if (this.loading && this.tasks.length === 0) {
      this.bodyEl.createDiv({ cls: "stw-empty", text: "Scanning…" });
      return;
    }

    // Triage sits above the work, in every mode that's a list. Sweep is a
    // run-through screen and Done is history — neither is a place to decide.
    const inbox = this.inboxTasks();
    const showInbox = inbox.length > 0 && this.mode !== "sweep" && this.horizon !== "done";
    if (showInbox) this.renderInbox(inbox, today);

    const tasks = this.visibleTasks();

    if (tasks.length === 0) {
      if (showInbox) {
        this.bodyEl.createDiv({
          cls: "stw-inbox-only",
          text: "Nothing else on the list.",
        });
      } else {
        this.renderEmpty();
      }
      // The empty state explains a *search* itself, in terms of the term you
      // typed. Everything else still needs the filter hint, which used to be
      // skipped here — the one place a dead-end list most needed a reason.
      if (!this.search.trim()) {
        this.renderUndatedHint();
        this.renderParkedHint();
      }
      return;
    }

    if (this.searchEverywhere) this.renderSearchScopeNote(tasks);

    if (this.mode === "lanes") this.renderLanes(tasks, today);
    else if (this.mode === "sweep") this.renderSweep(tasks, today);
    else this.renderFocus(tasks, today);

    if (!this.searchEverywhere) {
      this.renderUndatedHint();
      this.renderParkedHint();
    }
    this.renderSearchElsewhereHint(tasks);
  }

  /** Banner for unfiltered search: the chips above are not in force. */
  private renderSearchScopeNote(tasks: SmartTask[]): void {
    const note = this.bodyEl.createDiv({ cls: "stw-undated-hint" });
    const done = tasks.filter((t) => t.status === "done").length;
    note.createSpan({
      text:
        `Every match for "${this.search.trim()}" — When and effort filters are off` +
        (done > 0 ? `, including ${done} completed.` : "."),
    });
    const btn = note.createEl("button", { cls: "stw-undated-btn", text: "Back to filters" });
    btn.addEventListener("click", () => {
      this.searchEverywhere = false;
      this.renderFilters();
      this.render();
    });
  }

  /**
   * The list has matches, but so does the rest of the vault.
   *
   * Without this, a search that finds one of three gala tasks looks complete.
   * The count is the whole point: it's the difference between "that's all of
   * it" and "there's more, one click away".
   */
  private renderSearchElsewhereHint(shown: SmartTask[]): void {
    if (!this.search.trim() || this.searchEverywhere) return;
    const all = matchesSearch(this.listTasks, this.search);
    const hidden = all.length - shown.length;
    if (hidden <= 0) return;

    const hint = this.bodyEl.createDiv({ cls: "stw-undated-hint" });
    hint.createSpan({
      text: `${hidden} more match${hidden === 1 ? "" : "es"} outside ${this.horizonLabel()} — ${
        this.describeMatches(all.filter((t) => !shown.includes(t))) || "filtered out"
      }.`,
    });
    const btn = hint.createEl("button", { cls: "stw-undated-btn", text: "Show all matches" });
    btn.addEventListener("click", () => this.showAllMatches());
  }

  private horizonLabel(): string {
    switch (this.horizon) {
      case "today":
        return "Today";
      case "week":
        return "This week";
      case "done":
        return "Done";
      default:
        return "the current filters";
    }
  }

  /** "2 completed, 1 with no due date" — why those matches aren't on the list. */
  private describeMatches(tasks: SmartTask[]): string {
    const done = tasks.filter((t) => t.status === "done").length;
    const undated = tasks.filter((t) => t.status === "open" && !t.due).length;
    const other = tasks.length - done - undated;
    const parts: string[] = [];
    if (done > 0) parts.push(`${done} completed`);
    if (undated > 0) parts.push(`${undated} with no due date`);
    if (other > 0) parts.push(`${other} dated outside the window`);
    return parts.join(", ");
  }

  /**
   * Say what the When filter is holding back.
   *
   * Today and This Week both require a due date, so a task with no date is
   * invisible in either — and because the list isn't *empty*, the empty state
   * never gets a chance to explain. That's how tracking a project note can
   * report "10 open tasks" and show you nothing: a shopping list has no due
   * dates. The count is only drawn when something is actually hidden, so it
   * stays silent on a fully dated list.
   */
  private renderUndatedHint(): void {
    if (this.horizon !== "today" && this.horizon !== "week") return;

    const hidden = this.listTasks.filter(
      (t) =>
        t.status === "open" &&
        !t.due &&
        !isResting(t) &&
        matchesCategory(t, this.category) &&
        fitsBudget(t, this.budget)
    ).length;
    if (hidden === 0) return;

    const hint = this.bodyEl.createDiv({ cls: "stw-undated-hint" });
    hint.createSpan({
      text: `${hidden} undated task${hidden === 1 ? "" : "s"} hidden — ${
        this.horizon === "today" ? "Today" : "This week"
      } only shows work with a date.`,
    });
    const btn = hint.createEl("button", { cls: "stw-undated-btn", text: "Show all" });
    btn.addEventListener("click", () => {
      this.horizon = "all";
      // Repaint the When button too, or it keeps claiming "Today".
      this.renderFilters();
      void this.refresh();
    });
  }

  /**
   * Say how many tasks are parked, and offer the one click to them.
   *
   * All now excludes anything deferred more than a week out. That's the right
   * default — a task that comes back in January is not today's list — but a
   * filter that silently removes work is indistinguishable from a bug, which
   * is the exact complaint this release is fixing. So: state the count.
   */
  private renderParkedHint(): void {
    if (this.horizon !== "all") return;

    const parked = this.listTasks.filter(
      (t) =>
        t.status === "open" &&
        isParked(t) &&
        matchesCategory(t, this.category) &&
        fitsBudget(t, this.budget)
    ).length;
    if (parked === 0) return;

    const hint = this.bodyEl.createDiv({ cls: "stw-undated-hint" });
    hint.createSpan({
      text: `${parked} task${parked === 1 ? "" : "s"} deferred more than a week out.`,
    });
    const btn = hint.createEl("button", { cls: "stw-undated-btn", text: "Show deferred" });
    btn.addEventListener("click", () => {
      this.horizon = "deferred";
      this.renderFilters();
      void this.refresh();
    });
  }

  // --- Inbox ---------------------------------------------------------------
  //
  // 0.9. Before this, captures from the Stream voice ring landed in the same
  // merged list as everything else, with no way to tell triaged from
  // untriaged and no way to promote one except cutting the line by hand in
  // the note. The split existed on disk (a file only the ingest script writes)
  // but not in the UI, which made it a write-safety boundary and nothing more.
  //
  // Three verbs, because that's all triage is: Keep it (move it into the
  // working list), Edit it (it arrived half-formed), Drop it (never mind).

  private renderInbox(inbox: SmartTask[], today: Date): void {
    const wrap = this.bodyEl.createDiv({ cls: "stw-inbox" });

    const head = wrap.createDiv({ cls: "stw-inbox-head" });
    const caret = head.createSpan({ cls: "stw-inbox-caret" });
    setIcon(caret, this.inboxOpen ? "chevron-down" : "chevron-right");
    head.createSpan({ cls: "stw-inbox-title", text: "Inbox" });
    head.createSpan({ cls: "stw-inbox-count", text: String(inbox.length) });
    head.setAttr(
      "aria-label",
      `${inbox.length} untriaged capture${inbox.length === 1 ? "" : "s"} — click to ${
        this.inboxOpen ? "collapse" : "expand"
      }`
    );
    head.addEventListener("click", () => {
      this.inboxOpen = !this.inboxOpen;
      this.render();
    });

    if (!this.inboxOpen) return;

    wrap.createDiv({
      cls: "stw-inbox-note",
      text: "Captured, not yet decided. Keep moves it onto the list.",
    });

    for (const task of inbox) this.renderInboxRow(wrap, task, today);
  }

  /**
   * A triage row. No checkbox: ticking a capture off is the ambiguous act —
   * did you do it, or did you decide it wasn't real? Keep and Drop answer
   * that, and the size/category chips are live so the one thing triage
   * actually needs (how big is this?) can be set without leaving the row.
   */
  private renderInboxRow(parent: HTMLElement, task: SmartTask, today: Date): void {
    const row = parent.createDiv({ cls: "stw-inbox-row" });

    const titleEl = row.createDiv({
      cls: "stw-task-title",
      text: displayTitle(task.title) || "(untitled capture)",
    });
    titleEl.setAttr("title", `Click to edit · ${task.filePath}:${task.lineNumber + 1}`);
    titleEl.addEventListener("click", () => this.openEditor(task));

    const meta = row.createDiv({ cls: "stw-task-meta" });
    this.renderCategoryChip(meta, task);
    this.renderEffortPill(meta, task);
    if (task.due) {
      meta.createSpan({ cls: "stw-date", text: this.humanDate(task.due, today) });
    }

    const actions = row.createDiv({ cls: "stw-inbox-actions" });

    const target = this.plugin.primaryFile;
    const keep = actions.createEl("button", { cls: "stw-inbox-btn is-keep", text: "Keep" });
    keep.setAttr("aria-label", `Move it into ${target}`);
    keep.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      keep.disabled = true;
      const ok = await safeWrite(() => moveTaskLine(this.app, task, target));
      if (ok) new Notice(`Smart ToDo: kept → ${target}`, 3000);
      await this.refresh();
    });

    const edit = actions.createEl("button", { cls: "stw-inbox-btn", text: "Edit" });
    edit.setAttr("aria-label", `Fix the wording, size or date — saving keeps it in ${target}`);
    edit.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.openEditor(task);
    });

    const drop = actions.createEl("button", { cls: "stw-inbox-btn is-drop", text: "Drop" });
    // Said plainly, because "drop" could reasonably mean delete and doesn't.
    drop.setAttr("aria-label", "Let it go — the line stays, ticked and dated");
    drop.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      drop.disabled = true;
      await safeWrite(() => dropTask(this.app, task));
      await this.refresh();
    });
  }

  private renderEmpty(): void {
    const empty = this.bodyEl.createDiv({ cls: "stw-empty" });

    // An empty list has three very different causes and they need different
    // next actions. Saying which one it is turns a dead end into a button.
    if (this.listTasks.length === 0) {
      empty.createDiv({ cls: "stw-empty-head", text: "No tasks in scope." });
      empty.createDiv({
        cls: "stw-empty-note",
        text: `Watching ${describeScope(this.plugin.scope)}`,
      });
      return;
    }

    if (this.search.trim()) {
      const term = this.search.trim();
      // Search runs *inside* the current filters, so "nothing matches" is only
      // ever true of this corner of the list. Saying it flat is a lie by
      // omission — and the "press Enter" that followed it invited a duplicate
      // of a task that was already there. Count the matches the filters are
      // holding back, name them, and offer the one click that shows them.
      const elsewhere = this.searchEverywhere ? [] : matchesSearch(this.listTasks, term);
      if (elsewhere.length > 0) {
        empty.createDiv({
          cls: "stw-empty-head",
          text: `No "${term}" under ${this.horizonLabel()}.`,
        });
        empty.createDiv({
          cls: "stw-empty-note",
          text: `${elsewhere.length} match${elsewhere.length === 1 ? "" : "es"} elsewhere — ${
            this.describeMatches(elsewhere) || "filtered out"
          }.`,
        });
        const btn = empty.createEl("button", { cls: "stw-btn", text: "Show all matches" });
        btn.addEventListener("click", () => this.showAllMatches());
        return;
      }

      empty.createDiv({ cls: "stw-empty-head", text: `Nothing matches "${term}".` });
      empty.createDiv({ cls: "stw-empty-note", text: "Press Enter to add it as a task." });
      return;
    }

    if (this.budget !== "any") {
      const untagged = this.listTasks.filter(
        (t) => matchesHorizon(t, this.horizon) && matchesCategory(t, this.category) && !t.effort
      ).length;
      empty.createDiv({ cls: "stw-empty-head", text: "Nothing fits that window." });
      if (untagged > 0) {
        // The honest explanation, not a shrug: a budget filter can only see
        // tasks whose size is known.
        empty.createDiv({
          cls: "stw-empty-note",
          text: `${untagged} task${untagged === 1 ? " has" : "s have"} no effort set, so ${
            untagged === 1 ? "it isn't" : "they aren't"
          } offered here.`,
        });
        const btn = empty.createEl("button", { cls: "stw-btn", text: "Show anything" });
        btn.addEventListener("click", () => {
          this.budget = "any";
          this.renderFilters();
          this.render();
        });
      }
      return;
    }

    // Dated-only horizons with undated work waiting: the same trap as the
    // budget filter above, and worth the same honest answer rather than a
    // congratulatory "Clear."
    if (this.horizon === "today" || this.horizon === "week") {
      const undated = this.listTasks.filter(
        (t) => t.status === "open" && !t.due && matchesCategory(t, this.category)
      ).length;
      if (undated > 0) {
        empty.createDiv({ cls: "stw-empty-head", text: "Nothing dated for that window." });
        empty.createDiv({
          cls: "stw-empty-note",
          text: `${undated} open task${undated === 1 ? " has" : "s have"} no due date, so ${
            undated === 1 ? "it doesn't" : "they don't"
          } show under ${this.horizon === "today" ? "Today" : "This week"}.`,
        });
        const btn = empty.createEl("button", { cls: "stw-btn", text: "Show all" });
        btn.addEventListener("click", () => {
          this.horizon = "all";
          this.renderFilters();
          void this.refresh();
        });
        return;
      }
    }

    empty.createDiv({ cls: "stw-empty-head", text: "Nothing here. Clear." });
  }

  /**
   * Focus: one list, sectioned by Eisenhower quadrant, with a count and a time
   * estimate on each header. The quick-wins banner sits after the first
   * section — close enough to the top to be a real offer, far enough down that
   * the important work is still what you read first.
   */
  private renderFocus(tasks: SmartTask[], today: Date): void {
    const split = groupBySource(tasks, (p) => this.isHomeFile(p));
    const grouped = groupByQuadrant(split.main, today);
    const quickies = tasks.filter((t) => t.effort === "light" && !isContainer(t));
    let bannerPlaced = false;

    for (const q of QUADRANT_ORDER) {
      const group = grouped[q];
      if (group.length === 0) continue;

      const def = QUADRANTS.find((d) => d.id === q)!;
      const head = this.bodyEl.createDiv({ cls: `stw-group-head is-${q}` });
      head.style.setProperty("--quad-color", QUADRANT_COLOR[q]);
      head.createSpan({ cls: "stw-group-title", text: def.label });
      const minutes = estimateMinutes(group);
      head.createSpan({
        cls: "stw-group-tally",
        text: minutes > 0 ? `${group.length} · ${formatDuration(minutes)}` : String(group.length),
      });
      head.setAttr("aria-label", def.advice);

      for (const task of group) this.renderRow(this.bodyEl, task, today);

      if (
        !bannerPlaced &&
        this.plugin.settings.showSweepBanner &&
        quickies.length >= 2 &&
        group.length > 0
      ) {
        this.renderSweepBanner(quickies);
        bannerPlaced = true;
      }
    }

    // A tracked note's tasks arrive as a set and belong to one piece of work,
    // so they sit under its name, below the day's own list, and fold away.
    for (const group of split.groups) this.renderSourceGroup(group, today);

    // The banner is placed inside the first quadrant section — which never
    // runs when every task came from a project note. Without this, tracking a
    // note full of three-minute errands loses the one control that batches
    // them.
    if (!bannerPlaced && this.plugin.settings.showSweepBanner && quickies.length >= 2) {
      this.renderSweepBanner(quickies);
    }
  }

  /** Tracker and inbox are "home"; anything else is a tracked project note. */
  private isHomeFile(path: string): boolean {
    return samePath(path, this.plugin.primaryFile) || samePath(path, this.plugin.inboxPath);
  }

  /** The heading for a tracked note's group — renamed label, else the filename. */
  private sourceLabel(path: string): string {
    const custom = this.plugin.settings.sourceLabels?.[path]?.trim();
    if (custom) return custom;
    return path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
  }

  private isSourceCollapsed(path: string): boolean {
    return (this.plugin.settings.collapsedSources ?? []).includes(path);
  }

  /**
   * One tracked note, folded under its own heading.
   *
   * The count stays on the header when it's shut, which is the whole bargain:
   * folding is "not now", not "gone". Click the header to fold; right-click to
   * rename it, open the note, or stop tracking.
   */
  private renderSourceGroup(group: SourceGroup, today: Date): void {
    const collapsed = this.isSourceCollapsed(group.path);
    const label = this.sourceLabel(group.path);

    const head = this.bodyEl.createDiv({
      cls: `stw-source-head${collapsed ? " is-collapsed" : ""}`,
    });
    const caret = head.createSpan({ cls: "stw-source-caret" });
    setIcon(caret, collapsed ? "chevron-right" : "chevron-down");
    setIcon(head.createSpan({ cls: "stw-source-head-icon" }), "file-text");
    head.createSpan({ cls: "stw-source-title", text: label });

    const minutes = estimateMinutes(group.tasks);
    head.createSpan({
      cls: "stw-source-tally",
      text:
        minutes > 0
          ? `${group.tasks.length} · ${formatDuration(minutes)}`
          : String(group.tasks.length),
    });
    head.setAttr(
      "aria-label",
      `${group.tasks.length} task${group.tasks.length === 1 ? "" : "s"} from ${
        group.path
      } — click to ${collapsed ? "expand" : "fold"}, right-click to rename`
    );

    head.addEventListener("click", () => void this.toggleSource(group.path));
    head.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const menu = new Menu();
      menu.addItem((item) =>
        item
          .setTitle("Rename this group…")
          .setIcon("pencil")
          .onClick(() => this.renameSource(group.path, head))
      );
      if (this.plugin.settings.sourceLabels?.[group.path]) {
        menu.addItem((item) =>
          item
            .setTitle("Use the note's name")
            .setIcon("rotate-ccw")
            .onClick(() => void this.setSourceLabel(group.path, ""))
        );
      }
      menu.addItem((item) =>
        item
          .setTitle("Open the note")
          .setIcon("file-text")
          .onClick(() => void this.revealTask(group.tasks[0]))
      );
      menu.addItem((item) =>
        item
          .setTitle("Stop tracking this note")
          .setIcon("x")
          .onClick(() => void this.plugin.toggleTracked(group.path))
      );
      menu.showAtMouseEvent(evt as MouseEvent);
    });

    if (collapsed) return;

    // Inside the note, split again by the heading each task sits under. On a
    // page like the weekly one that heading is most of the meaning — "Focus
    // this week", "Fund 4.0 Prep", "2025 Taxes" are three different kinds of
    // commitment, and flattened into one run of rows they read as a pile.
    if (!this.plugin.settings.groupByHeading) {
      for (const task of group.tasks) this.renderTree(group.tasks, task, today);
      return;
    }

    const sections = groupByHeading(group.tasks);
    for (const section of sections) {
      // A single unheaded preamble section would just be an empty label.
      if (section.heading && sections.length > 1) {
        const sub = this.bodyEl.createDiv({ cls: "stw-heading-head" });
        sub.createSpan({ cls: "stw-heading-title", text: section.heading });
        sub.createSpan({ cls: "stw-heading-tally", text: String(section.tasks.length) });
      }
      for (const task of section.tasks) this.renderTree(section.tasks, task, today);
    }
  }

  /**
   * Render a task at its nesting depth, but only once.
   *
   * `parseTasksFromContent` returns a flat list with `parentLine` pointing up,
   * so the tree is already there — this just skips any task whose parent is in
   * the same visible set (the parent's own call renders it) and indents the
   * rest. The alternative, rendering children as peers, loses the one thing the
   * indentation on the page was saying: *this is how that gets done*.
   */
  private renderTree(siblings: SmartTask[], task: SmartTask, today: Date): void {
    const depth = this.visibleDepth(siblings, task);
    if (depth < 0) return;
    this.renderRow(this.bodyEl, task, today, { hideSource: true, depth });
  }

  /** Indent level relative to the shallowest visible ancestor chain, or -1. */
  private visibleDepth(siblings: SmartTask[], task: SmartTask): number {
    let depth = 0;
    let current = task;
    // Walk up while the parent is also on screen; cap the walk so a malformed
    // chain can't spin.
    for (let i = 0; i < 8; i++) {
      const parent = siblings.find(
        (s) => s.filePath === current.filePath && s.lineNumber === current.parentLine
      );
      if (!parent) break;
      depth++;
      current = parent;
    }
    return Math.min(depth, 3);
  }

  private async toggleSource(path: string): Promise<void> {
    const current = this.plugin.settings.collapsedSources ?? [];
    this.plugin.settings.collapsedSources = current.includes(path)
      ? current.filter((p) => p !== path)
      : [...current, path];
    await this.plugin.saveSettings();
    this.render();
  }

  private async setSourceLabel(path: string, label: string): Promise<void> {
    const labels = { ...(this.plugin.settings.sourceLabels ?? {}) };
    // An empty name means "go back to the filename" — storing "" would make
    // every later read fall through the same check anyway, so drop the key.
    if (label.trim()) labels[path] = label.trim();
    else delete labels[path];
    this.plugin.settings.sourceLabels = labels;
    await this.plugin.saveSettings();
    this.render();
  }

  /** Rename in place: the header becomes an input, Enter commits, Esc cancels. */
  private renameSource(path: string, head: HTMLElement): void {
    head.empty();
    const input = head.createEl("input", {
      cls: "stw-source-rename",
      attr: { type: "text", value: this.sourceLabel(path), placeholder: "Group name" },
    }) as HTMLInputElement;
    input.addEventListener("click", (evt) => evt.stopPropagation());
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        void this.setSourceLabel(path, input.value);
      } else if (evt.key === "Escape") {
        evt.preventDefault();
        this.render();
      }
    });
    input.addEventListener("blur", () => void this.setSourceLabel(path, input.value));
    input.focus();
    input.select();
  }

  /**
   * A tiny ring, drawn beside any time estimate.
   *
   * Deliberately the same motif as the sweep timer's countdown ring, so the
   * "about 27m" on the banner and the "2:14 / of 3:00" you see mid-sweep read
   * as the same idea at two sizes. A partial arc rather than a full circle —
   * a complete ring looks like a status dot, an arc looks like elapsed time.
   */
  private renderTimeGlyph(parent: HTMLElement): void {
    const svg = parent.createSvg("svg", {
      cls: "stw-time-glyph",
      attr: {
        viewBox: "0 0 16 16",
        width: "12",
        height: "12",
        "aria-hidden": "true",
        focusable: "false",
      },
    });
    const ring = { cx: "8", cy: "8", r: "6", fill: "none", "stroke-width": "2" };
    svg.createSvg("circle", { cls: "stw-time-glyph-track", attr: { ...ring } });
    svg.createSvg("circle", {
      cls: "stw-time-glyph-arc",
      attr: {
        ...ring,
        "stroke-linecap": "round",
        // r=6 → circumference 37.7; 26.4 ≈ 70% of the way round.
        "stroke-dasharray": "26.4 37.7",
        transform: "rotate(-90 8 8)",
      },
    });
  }

  /**
   * The quick-wins banner. This is the element that most changes behaviour:
   * it names the pile of small stuff as a single batch with a duration and a
   * button, which is the difference between "41 open tasks" and "ten minutes".
   */
  private renderSweepBanner(quickies: SmartTask[]): void {
    const banner = this.bodyEl.createDiv({ cls: "stw-sweep-banner" });
    const icon = banner.createSpan({ cls: "stw-sweep-banner-icon" });
    setIcon(icon, "zap");
    const text = banner.createDiv({ cls: "stw-sweep-banner-text" });
    text.createDiv({
      cls: "stw-sweep-banner-head",
      text: `${quickies.length} quick win${quickies.length === 1 ? "" : "s"}`,
    });
    const sub = text.createDiv({ cls: "stw-sweep-banner-sub" });
    this.renderTimeGlyph(sub);
    sub.createSpan({ text: `about ${formatDuration(estimateMinutes(quickies))}` });
    const btn = banner.createEl("button", { cls: "stw-sweep-banner-btn", text: "Sweep" });
    btn.addEventListener("click", () => this.startSweep(quickies));
  }

  /** Sweep mode: the queue, previewed, with one button that starts the clock. */
  private renderSweep(tasks: SmartTask[], today: Date): void {
    const queue = tasks.filter((t) => t.effort === "light" && !isContainer(t));

    const head = this.bodyEl.createDiv({ cls: "stw-sweep-intro" });
    head.createDiv({
      cls: "stw-sweep-intro-head",
      text: queue.length === 0 ? "Nothing under 3 minutes." : "Everything under 3 minutes",
    });
    const sub = head.createDiv({ cls: "stw-sweep-intro-sub" });
    if (queue.length === 0) {
      sub.createSpan({ text: "Tag a task's effort as 3 min and it shows up here." });
    } else {
      this.renderTimeGlyph(sub);
      sub.createSpan({
        text: `${queue.length} task${queue.length === 1 ? "" : "s"} · about ${formatDuration(
          estimateMinutes(queue)
        )}`,
      });
    }
    if (queue.length > 0) {
      const btn = head.createEl("button", { cls: "stw-btn is-primary", text: "Start sweep" });
      btn.addEventListener("click", () => this.startSweep(queue));
    }

    for (const task of queue) this.renderRow(this.bodyEl, task, today);
  }

  private startSweep(queue: SmartTask[]): void {
    new SweepModal(this.app, queue, this.plugin.settings.sweepSeconds, () =>
      void this.refresh()
    ).open();
  }

  /**
   * Start a sweep over whatever is currently in scope, for the command palette.
   *
   * Deliberately built from `visibleTasks()` rather than the whole vault: if
   * you've narrowed to Betaworks, a sweep you start from the keyboard should
   * be the Betaworks quick wins, not every loose end you own.
   */
  sweepNow(): boolean {
    const queue = this.visibleTasks().filter((t) => t.effort === "light" && !isContainer(t));
    if (queue.length === 0) return false;
    this.startSweep(queue);
    return true;
  }

  /**
   * Lanes: the kanban-by-size view from the mockups. In a narrow sidebar the
   * columns become stacked sections with a sticky header; in a wide leaf they
   * sit side by side. Same DOM either way — it's a CSS decision, not a mode.
   */
  private renderLanes(tasks: SmartTask[], today: Date): void {
    const lanes = this.bodyEl.createDiv({ cls: "stw-lanes" });

    for (const effort of EFFORTS) {
      const group = tasks.filter((t) => t.effort === effort);
      const lane = lanes.createDiv({ cls: `stw-lane is-${effort}` });

      const head = lane.createDiv({ cls: "stw-lane-head" });
      head.createSpan({ cls: "stw-lane-title", text: EFFORT_LABEL[effort] });
      head.createSpan({
        cls: "stw-lane-tally",
        text:
          group.length === 0
            ? "—"
            : `${group.length} · ${formatDuration(group.length * EFFORT_MINUTES[effort])}`,
      });
      head.createDiv({ cls: "stw-lane-blurb", text: EFFORT_BLURB[effort] });

      const body = lane.createDiv({ cls: "stw-lane-body" });
      if (group.length === 0) {
        body.createDiv({ cls: "stw-lane-empty", text: "Empty" });
        continue;
      }
      for (const task of group) this.renderRow(body, task, today);
    }

    const untagged = tasks.filter((t) => !t.effort);
    if (untagged.length === 0) return;

    // Unsized work is invisible to every budget filter, so lanes is the one
    // place that has to show it — otherwise it quietly never gets triaged.
    const lane = lanes.createDiv({ cls: "stw-lane is-untagged" });
    const head = lane.createDiv({ cls: "stw-lane-head" });
    head.createSpan({ cls: "stw-lane-title", text: "Unsized" });
    head.createSpan({ cls: "stw-lane-tally", text: String(untagged.length) });
    head.createDiv({ cls: "stw-lane-blurb", text: "No effort set — hidden from budgets" });
    const body = lane.createDiv({ cls: "stw-lane-body" });
    for (const task of untagged) this.renderRow(body, task, today);
  }

  // --- Row -----------------------------------------------------------------

  private renderRow(
    parent: HTMLElement,
    task: SmartTask,
    today: Date,
    opts: { hideSource?: boolean; depth?: number } = {}
  ): void {
    const row = parent.createDiv({ cls: "stw-row-task" });
    if (opts.depth) {
      row.addClass("is-child");
      row.style.setProperty("--stw-depth", String(opts.depth));
    }
    if (isContainer(task)) row.addClass("is-container");
    if (task.status === "done") row.addClass("is-done");
    if (task.due && task.due.getTime() < today.getTime() && task.status === "open") {
      row.addClass("is-overdue");
    }
    if (isResting(task, today)) row.addClass("is-resting");

    const checkbox = row.createEl("input", {
      cls: "stw-check",
      attr: { type: "checkbox" },
    }) as HTMLInputElement;
    checkbox.checked = task.status === "done";
    checkbox.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      checkbox.disabled = true;
      const ok = await safeWrite(() => toggleTaskDone(this.app, task, task.status === "open"));
      if (!ok) checkbox.checked = task.status === "done";
      await this.refresh();
    });

    const main = row.createDiv({ cls: "stw-task-main" });

    const titleEl = main.createDiv({
      cls: "stw-task-title",
      text: displayTitle(task.title) || "(untitled task)",
    });
    titleEl.addEventListener("click", () => this.openEditor(task));
    titleEl.setAttr("title", `Click to edit · ${task.filePath}:${task.lineNumber + 1}`);

    const meta = main.createDiv({ cls: "stw-task-meta" });

    // The project this belongs to, when the project itself isn't on screen.
    //
    // A project in this vault is a parent checkbox — "Fund 4 build to 30M"
    // with its calls and updates indented under it. Focus mode filters on the
    // *children*, so the parent gets dropped and what's left is a bare "Do
    // call with Jim to start to setup with Stepstone", which is the one thing
    // the indentation on the page was there to prevent. Under renderTree the
    // parent is visible directly above (depth > 0) and this would just repeat
    // it, so it only renders when the chain is actually broken.
    if (!opts.depth) this.renderParentChip(meta, task);

    // A container's own count, so a folded-looking parent still says how much
    // is under it.
    if (isContainer(task)) {
      meta.createSpan({
        cls: "stw-subcount",
        text: `${task.openChildren} open`,
        attr: { "aria-label": "This has sub-tasks — the work is in those" },
      });
    }

    // Why this task counts as important, when the panel inferred it rather
    // than being told. A list that silently reclassifies your work is one you
    // stop trusting, so the inference shows its source.
    if (task.important === true && task.importantFrom && task.importantFrom !== "field") {
      const from = task.importantFrom;
      meta.createSpan({
        cls: "stw-why",
        text:
          from === "priority"
            ? PRIORITY_MARK[task.priority ?? "medium"]
            : from === "heading"
              ? "§"
              : "↳",
        attr: {
          "aria-label":
            from === "priority"
              ? `Important: priority ${task.priority} on the line`
              : from === "heading"
                ? `Important: under "${task.heading}"`
                : "Important: inherited from the task above",
          title:
            from === "priority"
              ? `Marked ${task.priority} priority in the note`
              : from === "heading"
                ? `Under the heading "${task.heading}"`
                : "Inherited from its parent task",
        },
      });
    }

    this.renderCategoryChip(meta, task);

    // Under a tracked-note group the header already names the note, so the
    // chip would repeat it on every row.
    if (!opts.hideSource) this.renderSourceChip(meta, task);

    this.renderEffortPill(meta, task);

    if (task.due) {
      meta.createSpan({ cls: "stw-date", text: this.humanDate(task.due, today) });
    }
    if (isResting(task, today)) {
      meta.createSpan({
        cls: "stw-date is-defer",
        text: `deferred until ${this.humanDate(task.defer as Date, today)}`,
      });
    }
    if (task.pushes > 0) {
      const warn = task.pushes >= this.plugin.settings.pushesWarnThreshold;
      meta.createSpan({
        cls: `stw-pushes${warn ? " is-warn" : ""}`,
        text: `↻ ${task.pushes}`,
        attr: {
          "aria-label": `Pushed ${task.pushes} ${task.pushes === 1 ? "time" : "times"}`,
        },
      });
    }
    if (task.assigned) {
      meta.createSpan({ cls: "stw-assigned", text: `@${task.assigned}` });
    }
    // "I decided not to" and "I did it" are different outcomes, so a dropped
    // capture says so rather than masquerading as finished work.
    if (task.dropped) {
      meta.createSpan({ cls: "stw-date is-dropped", text: `dropped ${formatDate(task.dropped)}` });
    } else if (task.status === "done" && task.doneDate) {
      meta.createSpan({ cls: "stw-date", text: `done ${formatDate(task.doneDate)}` });
    }

    const actions = row.createDiv({ cls: "stw-task-actions" });
    // Importance moved from a star beside the title to the right-hand gutter:
    // in Focus the quadrant heading already states the judgment, so the control
    // only needs to be reachable, not loud.
    this.renderImportanceToggle(actions, task);

    if (task.status === "open") {
      const pushBtn = actions.createEl("button", {
        cls: "stw-icon-btn is-ghost",
        attr: {
          "aria-label": "Push to tomorrow — right-click for longer",
          title: "Push to tomorrow (defer until then). Right-click for longer.",
        },
      });
      setIcon(pushBtn, "chevrons-right");
      pushBtn.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        pushBtn.disabled = true;
        await this.push(task, 1);
      });
      pushBtn.addEventListener("contextmenu", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const menu = new Menu();
        for (const [days, label] of [
          [1, "Tomorrow"],
          [2, "In 2 days"],
          [7, "Next week"],
        ] as [number, string][]) {
          menu.addItem((item) =>
            item.setTitle(label).onClick(() => void this.push(task, days))
          );
        }
        menu.showAtMouseEvent(evt as MouseEvent);
      });
    }
  }

  /**
   * Push and say what happened.
   *
   * The notice exists because the effect is deliberately invisible in the place
   * you clicked: a pushed task leaves Do First and drops out of Today, which
   * from the row's point of view looks identical to nothing happening. One line
   * naming the new date — and the section it moved to — is the difference.
   */
  private async push(task: SmartTask, days: number): Promise<void> {
    const ok = await safeWrite(() => pushTask(this.app, task, days));
    if (ok) {
      const when = pushTargetDate(task, days);
      new Notice(
        `Pushed to ${this.humanDate(when, startOfToday())} — deferred until then, ` +
          `so it's out of Do First.`,
        4000
      );
    }
    await this.refresh();
  }

  /**
   * The size control. Effort reads as a duration, not a weight class — "3 min"
   * is a fact you can act on, "Light" was a label you had to translate first.
   * Unsized shows "+ size" rather than nothing, because an unsized task is
   * invisible to every budget filter and that needs to be fixable in place.
   */
  private renderEffortPill(parent: HTMLElement, task: SmartTask): void {
    const open = (evt: MouseEvent): void => {
      evt.preventDefault();
      evt.stopPropagation();
      this.showEffortMenu(evt, task);
    };

    if (!task.effort) {
      const unset = parent.createSpan({ cls: "stw-effort is-unset", text: "+ size" });
      unset.addEventListener("click", open);
      return;
    }

    const pill = parent.createSpan({
      cls: `stw-effort is-${task.effort}`,
      attr: { "aria-label": "Click to change" },
    });
    if (task.effort === "light") setIcon(pill.createSpan({ cls: "stw-effort-bolt" }), "zap");
    pill.createSpan({ text: EFFORT_LABEL[task.effort] });
    pill.addEventListener("click", open);
    pill.addEventListener("contextmenu", open);
  }

  /**
   * Importance. Three states cycle on click:
   *   unjudged (?) → important (★) → not important (☆) → unjudged
   * Right-click clears to unjudged. This is the only control that sets the
   * "important" axis; urgency is always derived from the due date.
   */
  private renderImportanceToggle(parent: HTMLElement, task: SmartTask): void {
    // One glyph, three states — the same spiral the `/` menu offers, so the
    // thing you picked while typing is the thing you see in the list.
    const state = task.important === true ? "yes" : task.important === false ? "no" : "unjudged";
    const star = parent.createSpan({
      cls: `stw-star is-${state}`,
      attr: {
        "aria-label":
          state === "yes" ? "important" : state === "no" ? "not important" : "set importance",
      },
    });
    setIcon(star, SPIRAL_ICON_ID);

    star.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const next = task.important === null ? true : task.important === true ? false : null;
      void safeWrite(() => setTaskImportant(this.app, task, next)).then(() => this.refresh());
    });
    star.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void safeWrite(() => setTaskImportant(this.app, task, null)).then(() => this.refresh());
    });
  }

  private showEffortMenu(evt: MouseEvent, task: SmartTask): void {
    const menu = new Menu();
    for (const effort of EFFORTS) {
      menu.addItem((item) =>
        item
          .setTitle(EFFORT_LABEL[effort])
          .setChecked(task.effort === effort)
          .onClick(async () => {
            await safeWrite(() => setTaskEffort(this.app, task, effort as Effort));
            await this.refresh();
          })
      );
    }
    menu.addSeparator();
    menu.addItem((item) =>
      item.setTitle("Clear size").onClick(async () => {
        await safeWrite(() => setTaskEffort(this.app, task, null));
        await this.refresh();
      })
    );
    menu.showAtMouseEvent(evt);
  }

  /**
   * Where a task came from, when that isn't obvious.
   *
   * Most rows live in the tracker or the inbox and naming the file would be
   * noise on every line. A task pulled in from a tracked project note is
   * different: "Buy peanut oil" makes sense only once you know it's from the
   * Turkey Fry Prep page, and ticking it here ticks the checkbox *there*, so
   * the panel should say so. Clicking jumps to the line.
   */
  private renderSourceChip(parent: HTMLElement, task: SmartTask): void {
    if (samePath(task.filePath, this.plugin.primaryFile)) return;
    if (samePath(task.filePath, this.plugin.inboxPath)) return;

    const name = task.filePath.split("/").pop()?.replace(/\.md$/i, "") ?? task.filePath;
    const chip = parent.createSpan({
      cls: "stw-source-chip",
      attr: { "aria-label": `From ${task.filePath} — click to open` },
    });
    setIcon(chip.createSpan({ cls: "stw-source-icon" }), "file-text");
    chip.createSpan({ text: name });
    chip.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void this.revealTask(task);
    });
  }

  /**
   * The nearest ancestor task, from the full scan rather than the visible set.
   *
   * Walks the whole chain and takes the *top* of it, not the immediate parent:
   * two levels of indent under "Fund 4 build to 30M" is still Fund 4 work, and
   * naming the middle step tells you less than naming the project does.
   */
  private rootProject(task: SmartTask): SmartTask | null {
    let current = task;
    let root: SmartTask | null = null;
    for (let i = 0; i < 8; i++) {
      if (current.parentLine === null || current.parentLine === undefined) break;
      const parent = this.tasks.find(
        (t) => t.filePath === current.filePath && t.lineNumber === current.parentLine
      );
      if (!parent) break;
      root = parent;
      current = parent;
    }
    return root;
  }

  private renderParentChip(parent: HTMLElement, task: SmartTask): void {
    const project = this.rootProject(task);
    if (!project) return;
    const label = displayTitle(project.title).trim();
    if (!label) return;

    const chip = parent.createSpan({
      cls: "stw-parent-chip",
      attr: {
        "aria-label": `Part of “${label}” — click to open it`,
        title: `Part of “${label}”`,
      },
    });
    chip.createSpan({ cls: "stw-parent-mark", text: "↳" });
    // Truncation is CSS, not substring: a project title cut mid-word in the
    // DOM is also cut in the tooltip and in search.
    chip.createSpan({ cls: "stw-parent-label", text: label });
    chip.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void this.revealTask(project);
    });
  }

  private renderCategoryChip(parent: HTMLElement, task: SmartTask): void {
    const chip = parent.createSpan({ cls: "stw-cat-chip" });
    const canonical = asCategory(task.project);

    if (canonical) {
      chip.createSpan({
        cls: "stw-dot",
        attr: { style: `background:${CATEGORY_COLOR[canonical]}` },
      });
      chip.createSpan({ text: CATEGORY_LABEL[canonical] });
    } else if (task.project) {
      // A legacy, un-folded value keeps its own hashed color so it's visibly
      // not one of the three until the migration has run.
      chip.addClass("is-legacy");
      chip.createSpan({
        cls: "stw-dot",
        attr: { style: `background:${projectColor(task.project)}` },
      });
      chip.createSpan({ text: task.project });
      chip.setAttr("aria-label", "Not one of the three categories — click to set");
    } else {
      chip.addClass("is-unset");
      chip.setText("+ category");
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

  /**
   * Open the editor — and, for an untriaged capture, make Save decide.
   *
   * Triage has three answers and editing isn't a fourth one. Nobody fixes the
   * wording, sets a size and picks a category on something they then intend to
   * leave sitting in the Inbox; the work of deciding is already done by the
   * time you hit Save. So a saved capture is a kept capture, in one write —
   * the patched line goes straight to the tracker rather than being written
   * back to the inbox and moved a second time. Drop is still the way to say no.
   */
  private openEditor(task: SmartTask): void {
    const target = this.plugin.primaryFile;
    const keeps = this.plugin.isInboxTask(task) && !samePath(task.filePath, target);

    new EditTaskModal(
      this.app,
      task,
      async (patch: TaskPatch) => {
        if (keeps) {
          // Note the empty patch isn't an early exit here: opening a capture
          // and saving it unchanged is still a decision to keep it.
          const line = buildPatchedLine(task, patch);
          const ok = await safeWrite(() => moveTaskLine(this.app, task, target, line));
          if (ok) new Notice(`Smart ToDo: kept → ${target}`, 3000);
          await this.refresh();
          return;
        }
        if (Object.keys(patch).length === 0) return;
        await safeWrite(() => applyTaskPatch(this.app, task, patch));
        await this.refresh();
      },
      () => void this.revealTask(task),
      keeps ? target : null
    ).open();
  }

  private async revealTask(task: SmartTask): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(this.app.vault.getAbstractFileByPath(task.filePath) as any, {
      eState: { line: task.lineNumber },
    });
  }

  private humanDate(date: Date, today: Date): string {
    if (!date) return "";
    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, addDays(today, 1))) return "Tomorrow";
    if (isSameDay(date, addDays(today, -1))) return "Yesterday";
    const days = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (days < 0) return `${formatDate(date)} (${Math.abs(days)}d late)`;
    if (days <= 6) return date.toLocaleDateString(undefined, { weekday: "short" });
    return formatDate(date);
  }
}
