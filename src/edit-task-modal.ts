// Smart ToDo — the task editor.
//
// Before this, the panel could only *nudge* a task: cycle the star, pick an
// effort, push a day. Changing the wording or the date meant opening the note
// and editing markdown by hand, which defeats the point of having a panel.
// Clicking a row now opens this: every field the plugin models, in one place,
// written back as a single patched line.

import { App, Modal, Notice, setIcon } from "obsidian";
import { addDays, addMonths, formatDate, parseDate, startOfToday } from "./parser";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  Category,
  EFFORTS,
  EFFORT_LABEL,
  Effort,
  SmartTask,
  categoryFor,
} from "./types";
import { TaskPatch } from "./writer";

/** `<input type="date">` wants `YYYY-MM-DD`; empty string means "no date". */
function dateInputValue(date: Date | null): string {
  return date ? formatDate(date) : "";
}

export class EditTaskModal extends Modal {
  private draft: {
    title: string;
    due: Date | null;
    defer: Date | null;
    effort: Effort | null;
    category: Category | null;
    important: boolean | null;
    pushes: number;
  };

  constructor(
    app: App,
    private task: SmartTask,
    private onSubmit: (patch: TaskPatch) => void | Promise<void>,
    private onReveal: () => void,
    /**
     * Where Save will file this, when the task is an untriaged capture.
     *
     * Editing a capture *is* deciding about it — you don't straighten the
     * wording and size of something you're about to drop. So Save keeps it,
     * and the button says so rather than moving the row out from under you.
     * Null for an ordinary task: Save just saves.
     */
    private keepTarget: string | null = null
  ) {
    super(app);
    this.draft = {
      title: task.title,
      due: task.due,
      defer: task.defer,
      effort: task.effort,
      // A legacy free-text project folds onto a category for display, but
      // nothing is written unless the user actually picks one — opening the
      // editor and cancelling must not silently rewrite the line.
      category: categoryFor(task.project),
      important: task.important,
      pushes: task.pushes,
    };
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("smart-todo-edit-modal");
    contentEl.empty();

    contentEl.createEl("h3", { text: "Edit task" });

    // --- Title ---
    const titleInput = this.field(contentEl, "Task").createEl("input", {
      cls: "smart-todo-edit-input",
      attr: { type: "text" },
    }) as HTMLInputElement;
    titleInput.value = this.draft.title;
    titleInput.addEventListener("input", () => {
      this.draft.title = titleInput.value;
    });
    titleInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        void this.submit();
      }
    });

    // --- Category: exactly three, plus clear ---
    const catRow = this.field(contentEl, "Category").createDiv({
      cls: "smart-todo-seg",
    });
    const catBtns = new Map<Category | null, HTMLElement>();
    const paintCats = (): void => {
      for (const [value, btn] of catBtns) {
        btn.toggleClass("is-active", this.draft.category === value);
      }
    };
    for (const cat of CATEGORIES) {
      const btn = catRow.createEl("button", {
        cls: "smart-todo-seg-btn",
        text: CATEGORY_LABEL[cat],
      });
      btn.style.setProperty("--cat-color", CATEGORY_COLOR[cat]);
      btn.addEventListener("click", () => {
        this.draft.category = cat;
        paintCats();
      });
      catBtns.set(cat, btn);
    }
    const clearCat = catRow.createEl("button", {
      cls: "smart-todo-seg-btn is-clear",
      text: "None",
    });
    clearCat.addEventListener("click", () => {
      this.draft.category = null;
      paintCats();
    });
    catBtns.set(null, clearCat);
    paintCats();

    // Surface the pre-migration value so a fold-to-personal guess is visible
    // rather than silent.
    const legacy = this.task.project;
    if (legacy && !CATEGORIES.includes(legacy.toLowerCase() as Category)) {
      catRow.createDiv({
        cls: "smart-todo-edit-hint",
        text: `was "${legacy}"`,
      });
    }

    // --- Importance ---
    const impRow = this.field(
      contentEl,
      "Important"
    ).createDiv({ cls: "smart-todo-seg" });
    const impOptions: Array<{ value: boolean | null; label: string }> = [
      { value: true, label: "Yes" },
      { value: false, label: "No" },
      { value: null, label: "Not judged" },
    ];
    const impBtns: Array<[boolean | null, HTMLElement]> = [];
    const paintImp = (): void => {
      for (const [value, btn] of impBtns) {
        btn.toggleClass("is-active", this.draft.important === value);
      }
    };
    for (const opt of impOptions) {
      const btn = impRow.createEl("button", {
        cls: "smart-todo-seg-btn",
        text: opt.label,
      });
      btn.addEventListener("click", () => {
        this.draft.important = opt.value;
        paintImp();
      });
      impBtns.push([opt.value, btn]);
    }
    paintImp();
    this.hint(
      contentEl,
      "Important = it moves something you actually care about, or someone " +
        "else is blocked on it. Routine admin is not important, even when " +
        "it's expensive or overdue."
    );

    // --- Effort ---
    const effRow = this.field(contentEl, "Effort").createDiv({
      cls: "smart-todo-seg",
    });
    const effBtns: Array<[Effort | null, HTMLElement]> = [];
    const paintEff = (): void => {
      for (const [value, btn] of effBtns) {
        btn.toggleClass("is-active", this.draft.effort === value);
      }
    };
    for (const eff of EFFORTS) {
      const btn = effRow.createEl("button", {
        cls: `smart-todo-seg-btn is-effort-${eff}`,
        text: EFFORT_LABEL[eff],
      });
      btn.addEventListener("click", () => {
        this.draft.effort = eff;
        paintEff();
      });
      effBtns.push([eff, btn]);
    }
    const clearEff = effRow.createEl("button", {
      cls: "smart-todo-seg-btn is-clear",
      text: "None",
    });
    clearEff.addEventListener("click", () => {
      this.draft.effort = null;
      paintEff();
    });
    effBtns.push([null, clearEff]);
    paintEff();

    // --- Dates ---
    const dueWrap = this.field(contentEl, "Due");
    const dueInput = dueWrap.createEl("input", {
      cls: "smart-todo-edit-date",
      attr: { type: "date" },
    }) as HTMLInputElement;
    dueInput.value = dateInputValue(this.draft.due);
    dueInput.addEventListener("change", () => {
      this.draft.due = dueInput.value ? parseDate(dueInput.value) : null;
    });
    this.quickDates(dueWrap, (date) => {
      this.draft.due = date;
      dueInput.value = dateInputValue(date);
    });

    const deferWrap = this.field(contentEl, "Defer until");
    const deferInput = deferWrap.createEl("input", {
      cls: "smart-todo-edit-date",
      attr: { type: "date" },
    }) as HTMLInputElement;
    deferInput.value = dateInputValue(this.draft.defer);
    deferInput.addEventListener("change", () => {
      this.draft.defer = deferInput.value ? parseDate(deferInput.value) : null;
    });

    // Offsets, not fixed dates. Deferring is always "not for a while" — you
    // know the distance, not the date — which is why these read +1d rather
    // than Tomorrow. They count from whatever's already in the box when it's
    // in the future, so a second click on +1w pushes a further week instead of
    // quietly resetting to the same date; past or empty, they count from today.
    this.quickOffsets(deferWrap, (shift) => {
      const base = this.draft.defer;
      const today = startOfToday();
      const from = base && base.getTime() > today.getTime() ? base : today;
      const next = shift === null ? null : shift(from);
      this.draft.defer = next;
      deferInput.value = dateInputValue(next);
    });

    this.hint(
      deferWrap,
      "Hidden from Today and This Week until this date. Past a week out it " +
        "also leaves All, and shows under Deferred."
    );

    // --- Pushes ---
    if (this.task.pushes > 0) {
      const pushWrap = this.field(
        contentEl,
        `Pushed ${this.task.pushes}×`
      );
      const reset = pushWrap.createEl("button", {
        cls: "smart-todo-seg-btn",
        text: "Reset counter",
      });
      reset.addEventListener("click", () => {
        this.draft.pushes = 0;
        reset.setText("Will reset to 0");
        reset.addClass("is-active");
      });
    }

    // --- Actions ---
    const actions = contentEl.createDiv({ cls: "smart-todo-modal-actions" });

    const reveal = actions.createEl("button", {
      cls: "smart-todo-edit-reveal",
      text: "Open in note",
    });
    setIcon(reveal.createSpan({ cls: "smart-todo-edit-reveal-icon" }), "file-text");
    reveal.addEventListener("click", () => {
      this.close();
      this.onReveal();
    });

    const spacer = actions.createDiv({ cls: "smart-todo-modal-spacer" });
    spacer.setText("");

    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());

    const save = actions.createEl("button", {
      cls: "mod-cta",
      text: this.keepTarget ? "Save & keep" : "Save",
    });
    if (this.keepTarget) save.setAttr("aria-label", `Save and move into ${this.keepTarget}`);
    save.addEventListener("click", () => void this.submit());

    titleInput.focus();
    titleInput.select();
  }

  /** Today / Tomorrow / +1w / Clear shortcuts under the due field. */
  private quickDates(parent: HTMLElement, set: (date: Date | null) => void): void {
    const row = parent.createDiv({ cls: "smart-todo-quickdates" });
    const today = startOfToday();
    const opts: Array<{ label: string; date: Date | null }> = [
      { label: "Today", date: today },
      { label: "Tomorrow", date: addDays(today, 1) },
      { label: "+1 week", date: addDays(today, 7) },
      { label: "Clear", date: null },
    ];
    for (const opt of opts) {
      const btn = row.createEl("button", {
        cls: "smart-todo-quickdate",
        text: opt.label,
      });
      btn.addEventListener("click", () => set(opt.date));
    }
  }

  /**
   * +1d / +2d / +1w / +1m / Clear — the defer shortcuts.
   *
   * Each hands back a function rather than a date so the caller decides what
   * they count from; null is Clear.
   */
  private quickOffsets(
    parent: HTMLElement,
    set: (shift: ((from: Date) => Date) | null) => void
  ): void {
    const row = parent.createDiv({ cls: "smart-todo-quickdates" });
    const opts: Array<{ label: string; shift: ((from: Date) => Date) | null }> = [
      { label: "+1d", shift: (from) => addDays(from, 1) },
      { label: "+2d", shift: (from) => addDays(from, 2) },
      { label: "+1w", shift: (from) => addDays(from, 7) },
      { label: "+1m", shift: (from) => addMonths(from, 1) },
      { label: "Clear", shift: null },
    ];
    for (const opt of opts) {
      const btn = row.createEl("button", {
        cls: "smart-todo-quickdate",
        text: opt.label,
      });
      btn.addEventListener("click", () => set(opt.shift));
    }
  }

  private field(parent: HTMLElement, label: string): HTMLElement {
    const wrap = parent.createDiv({ cls: "smart-todo-edit-field" });
    wrap.createDiv({ cls: "smart-todo-edit-label", text: label });
    return wrap;
  }

  private hint(parent: HTMLElement, text: string): void {
    parent.createDiv({ cls: "smart-todo-edit-hint", text });
  }

  /**
   * Build the patch from what actually changed. Sending only diffs means an
   * untouched field can't be rewritten (or dropped) by opening the editor.
   */
  private async submit(): Promise<void> {
    const patch: TaskPatch = {};
    const d = this.draft;
    const t = this.task;

    if (!d.title.trim()) {
      new Notice("Smart ToDo: a task needs a title.", 4000);
      return;
    }
    if (d.title.trim() !== t.title) patch.title = d.title.trim();

    const sameDay = (a: Date | null, b: Date | null): boolean =>
      a === null || b === null ? a === b : a.getTime() === b.getTime();

    if (!sameDay(d.due, t.due)) patch.due = d.due;
    if (!sameDay(d.defer, t.defer)) patch.defer = d.defer;
    if (d.effort !== t.effort) patch.effort = d.effort;
    if (d.important !== t.important) patch.important = d.important;
    if (d.pushes !== t.pushes) patch.pushes = d.pushes;

    // Category writes only on an explicit pick: comparing against the folded
    // value would turn every "Investing" task into "Betaworks" just because
    // someone looked at it.
    const currentCanonical = t.project?.trim().toLowerCase() ?? null;
    if ((d.category ?? null) !== currentCanonical) patch.project = d.category;

    this.close();
    await this.onSubmit(patch);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
