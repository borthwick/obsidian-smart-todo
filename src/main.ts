// Smart ToDo — plugin entry point.
//
// Phase 1.5 scope: an *opt-in* set of managed files (default `Tasks.md`), a
// Today view with defer/effort/push triage, task capture into the managed
// file, and safe single-line write-back. No index persistence — the scan is
// cheap because scope is narrow by construction.

import { Menu, Notice, Plugin, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import { scanScope } from "./parser";
import {
  addPathToScope,
  isInScope,
  parseScope,
  primaryManagedFile,
  removePathFromScope,
  samePath,
  scopeIncludesPath,
} from "./scope";
import { SmartTodoSettingTab } from "./settings";
import { AddTaskModal } from "./add-task-modal";
import {
  DEFAULT_SETTINGS,
  ManagedScope,
  SmartTask,
  SmartTodoSettings,
  VIEW_TYPE_SMART_TODO,
  applyAccentVars,
} from "./types";
import { appendTask, ensureManagedFile, safeWrite, setTaskProject } from "./writer";
import { buildCaptureBody } from "./nlparse";
import { SmartTodoView } from "./view";
import { CategoryMigrationModal, planCategoryMigration } from "./categorize";

/**
 * Coalesce bursty vault events (Sync landing a batch) into one rescan.
 *
 * Short on purpose. Every write path already refreshes synchronously, so this
 * only covers edits made *outside* the panel — and a second of lag there read
 * as "the panel is stale", which is the one thing a task list can't be.
 */
const REFRESH_DEBOUNCE_MS = 250;

export default class SmartTodoPlugin extends Plugin {
  settings: SmartTodoSettings = DEFAULT_SETTINGS;

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.applyAccent();

    this.registerView(
      VIEW_TYPE_SMART_TODO,
      (leaf: WorkspaceLeaf) => new SmartTodoView(leaf, this)
    );

    this.addSettingTab(new SmartTodoSettingTab(this.app, this));

    this.addRibbonIcon("list-checks", "Smart ToDo: Today", () => {
      void this.activateView();
    });

    // Obsidian prefixes command names with the plugin name, so this shows in
    // the palette as "Smart ToDo: Open Today view".
    this.addCommand({
      id: "open-today-view",
      name: "Open Today view",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "add-task",
      name: "Add task",
      callback: () => {
        new AddTaskModal(this.app, (title) => void this.addTask(title)).open();
      },
    });

    this.addCommand({
      id: "refresh-tasks",
      name: "Rescan tasks",
      callback: () => this.refreshViews(),
    });

    // Both of these open the panel first if it's closed. A command that
    // silently does nothing because a sidebar isn't visible is worse than one
    // that takes a beat.
    this.addCommand({
      id: "quick-switch",
      name: "Quick switch (filters and tasks)",
      callback: () => {
        void this.withView((view) => view.openPalette());
      },
    });

    this.addCommand({
      id: "start-sweep",
      name: "Start a sweep of the 3-minute tasks",
      callback: () => {
        void this.withView((view) => {
          if (!view.sweepNow()) {
            new Notice("Smart ToDo: nothing tagged 3 min in the current filter.", 4000);
          }
        });
      },
    });

    // Tracking a project note is a two-second decision ("this week's turkey
    // list should be in the panel") and it should cost two seconds. Both the
    // command and the right-click entry below toggle, so untracking is the
    // same gesture — nobody has to go find the settings textarea again.
    this.addCommand({
      id: "track-active-note",
      name: "Track tasks in this note",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (checking) return true;
        void this.toggleTracked(file.path);
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        // Never offer to untrack the capture target: the panel has nowhere to
        // put a new task without it.
        if (samePath(file.path, this.primaryFile)) return;
        const tracked = scopeIncludesPath(this.settings.managedFiles, file.path);
        menu.addItem((item) =>
          item
            .setTitle(tracked ? "Smart ToDo: stop tracking tasks here" : "Smart ToDo: track tasks in this note")
            .setIcon("list-checks")
            .onClick(() => void this.toggleTracked(file.path))
        );
      })
    );

    this.addCommand({
      id: "migrate-categories",
      name: "Fold projects into categories (Betaworks / Personal / Health)",
      callback: () => void this.openCategoryMigration(),
    });

    // Create the managed file after the vault has finished indexing —
    // getAbstractFileByPath is unreliable mid-load and we'd create a duplicate.
    this.app.workspace.onLayoutReady(() => {
      void this.ensurePrimaryFile();
    });

    // Repaint when a managed file changes underneath us. Out-of-scope edits
    // are ignored outright, so typing in an unmanaged note costs nothing.
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && this.isInManagedScope(file.path)) {
          this.scheduleRefresh();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (this.isInManagedScope(file.path)) this.scheduleRefresh();
      })
    );
    // A rename can move a file in or out of scope, so don't filter on it.
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
  }

  onunload(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    // Don't leave our custom properties on body after we're gone.
    document.body.style.removeProperty("--stw-accent");
    document.body.style.removeProperty("--stw-accent-strong");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.applyAccent();
  }

  /**
   * Put the accent on `document.body`, not just the panel.
   *
   * Modals mount into `.modal-container` at body level — outside the view's
   * DOM entirely. With the properties set only on the panel, every
   * `var(--stw-accent)` inside the sweep screen resolved to nothing: no
   * progress ring, a grey badge instead of an accent one, and a "Done" button
   * whose background vanished, leaving white text on white. Setting them on
   * body covers every surface the plugin draws, modal or not.
   */
  private applyAccent(): void {
    applyAccentVars(document.body, this.settings.accent);
  }

  /**
   * Add or remove a note from the managed scope.
   *
   * Nothing is copied: the note keeps its own checkboxes and the panel edits
   * them in place, so ticking "Buy peanut oil" in Smart ToDo ticks it on the
   * Turkey Fry Prep page, and ticking it on the page updates the panel. That
   * also means untracking is free — it only stops the scan, it never touches
   * the note.
   */
  async toggleTracked(path: string): Promise<void> {
    if (samePath(path, this.primaryFile)) {
      new Notice("Smart ToDo: this is the main task file — it's always tracked.", 4000);
      return;
    }

    const tracked = scopeIncludesPath(this.settings.managedFiles, path);
    this.settings.managedFiles = tracked
      ? removePathFromScope(this.settings.managedFiles, path)
      : addPathToScope(this.settings.managedFiles, path);
    await this.saveSettings();
    this.refreshViews();

    const name = path.split("/").pop() ?? path;
    if (tracked) {
      new Notice(`Smart ToDo: no longer tracking ${name}. The note is unchanged.`, 4000);
      return;
    }

    // Count what actually arrived. "Tracking it" with nothing to show reads as
    // a failure, so say when a note has no open checkboxes rather than leaving
    // the user hunting the panel for tasks that were never there.
    const open = (await this.scan()).filter(
      (t) => samePath(t.filePath, path) && t.status === "open"
    );
    if (open.length === 0) {
      new Notice(`Smart ToDo: tracking ${name} — no open tasks in it yet.`, 5000);
      return;
    }
    // Count what the *current filters* will actually show. A project note is
    // the worst case for this: a shopping list has no due dates and no sizes,
    // so Today hides all of it and every budget but Any hides all of it —
    // and the panel isn't empty, so nothing on screen explains the gap. Say
    // it here rather than leaving him hunting a list he was just promised.
    const undated = open.filter((t) => !t.due).length;
    const unsized = open.filter((t) => !t.effort).length;
    const caveats: string[] = [];
    if (undated === open.length) caveats.push("none are dated, so set When → All to see them");
    else if (undated > 0) caveats.push(`${undated} undated (hidden under Today)`);
    if (unsized === open.length) caveats.push("none are sized, so they only show under the Any budget");
    else if (unsized > 0) caveats.push(`${unsized} unsized`);

    new Notice(
      `Smart ToDo: tracking ${name} — ${open.length} open task${open.length === 1 ? "" : "s"}.` +
        (caveats.length > 0 ? ` ${caveats.join("; ")}.` : ""),
      8000
    );
  }

  /** The managed scope as currently configured. */
  get scope(): ManagedScope {
    return parseScope(this.settings.managedFiles);
  }

  isInManagedScope(path: string): boolean {
    return isInScope(path, this.scope);
  }

  /** The file new tasks are appended to — and where Keep moves a capture. */
  get primaryFile(): string {
    return primaryManagedFile(this.scope);
  }

  /**
   * The configured capture file, or null when there's no inbox.
   *
   * `.md` is supplied when it's missing. Obsidian shows note names without the
   * extension everywhere, so typing the path you can see gets you
   * "…/Task inbox" — which matched nothing, left the Inbox bucket silently
   * empty, and looked exactly like the setting hadn't saved.
   */
  get inboxPath(): string | null {
    const raw = this.settings.inboxFile?.trim();
    if (!raw) return null;
    return /\.[a-z0-9]+$/i.test(raw) ? raw : `${raw}.md`;
  }

  /**
   * Is this an untriaged capture?
   *
   * Open *and* in the inbox file. A completed line there has already been
   * dealt with, so it rejoins the ordinary list (and shows under Done) rather
   * than sitting in the triage bucket forever.
   */
  isInboxTask(task: SmartTask): boolean {
    return task.status === "open" && samePath(task.filePath, this.inboxPath);
  }

  /** True when an inbox is configured but isn't actually being scanned. */
  get inboxOutOfScope(): boolean {
    const path = this.inboxPath;
    return !!path && !this.isInManagedScope(path);
  }

  async scan(): Promise<SmartTask[]> {
    return scanScope(this.app, this.scope);
  }

  /** Create the managed file if it's missing, so capture always has a target. */
  async ensurePrimaryFile(): Promise<void> {
    const path = this.primaryFile;
    if (this.app.vault.getAbstractFileByPath(path)) return;
    try {
      await ensureManagedFile(this.app, path);
      new Notice(`Smart ToDo: created ${path}`, 4000);
    } catch (e) {
      console.error("[smart-todo] could not create managed file", path, e);
    }
  }

  /**
   * Capture a task from natural language into the managed file. "Buy the milk
   * tomorrow" becomes "Buy the milk 📅 <tomorrow>" — the date phrase is parsed
   * out and the title left clean. Plain titles with no date phrase pass through
   * unchanged.
   */
  async addTask(title: string): Promise<boolean> {
    const trimmed = title.trim();
    if (!trimmed) return false;
    const body = buildCaptureBody(this.app, trimmed);
    const ok = await safeWrite(() => appendTask(this.app, this.primaryFile, body));
    if (ok) this.refreshViews();
    return ok;
  }

  /**
   * Preview, then apply, the project → category fold.
   *
   * Writes run one line at a time through `setTaskProject`, sequentially: each
   * call re-verifies the line it's replacing, and only one line changes per
   * write, so a concurrent edit elsewhere in the file can't be clobbered and a
   * mid-run failure leaves the earlier tasks correctly retagged.
   */
  async openCategoryMigration(): Promise<void> {
    const tasks = await this.scan();
    const changes = planCategoryMigration(tasks);
    new CategoryMigrationModal(this.app, changes, async () => {
      let applied = 0;
      for (const change of changes) {
        const ok = await safeWrite(() =>
          setTaskProject(this.app, change.task, change.to)
        );
        if (!ok) break;
        applied++;
      }
      new Notice(
        `Smart ToDo: retagged ${applied} of ${changes.length} task${
          changes.length === 1 ? "" : "s"
        }.`,
        5000
      );
      this.refreshViews();
    }).open();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refreshViews();
    }, REFRESH_DEBOUNCE_MS);
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SMART_TODO)) {
      const view = leaf.view;
      if (view instanceof SmartTodoView) void view.refresh();
    }
  }

  /**
   * Full teardown and redraw, for changes a refresh can't carry: the accent
   * writes CSS custom properties onto the root element at build time, and the
   * mode row's labels are baked into the DOM.
   */
  rebuildViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SMART_TODO)) {
      const view = leaf.view;
      if (view instanceof SmartTodoView) view.rebuild();
    }
  }

  /**
   * Run an action against the panel, opening it first if it's closed.
   *
   * Palette and Sweep are both commands, and a command that quietly does
   * nothing because the sidebar happens to be shut is the worst outcome — so
   * these take a beat to reveal the leaf rather than failing silently.
   */
  private async withView(fn: (view: SmartTodoView) => void): Promise<void> {
    await this.activateView();
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_SMART_TODO)[0];
    if (!leaf || !(leaf.view instanceof SmartTodoView)) return;
    fn(leaf.view);
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SMART_TODO);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_SMART_TODO, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
