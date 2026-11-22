// Smart ToDo — Sweep: a timed run through the small stuff.
//
// The idea comes straight out of the mockups, and it's the only screen here
// that isn't a way of *looking* at the list — it's a way of spending ten
// minutes. One task at a time, a countdown, and three keys: done, skip, this
// is bigger than I thought.
//
// Why a modal rather than a panel mode: a sweep is a mode of *you*, not of the
// view. It wants the whole screen's attention for the few minutes it runs, and
// it should end by putting you back exactly where you were. Keyboard-first for
// the same reason — once it starts, your hands shouldn't leave Space.

import { App, Modal, setIcon } from "obsidian";
import { formatDuration } from "./filters";
import { displayTitle } from "./parser";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  EFFORT_MINUTES,
  Effort,
  SmartTask,
  categoryFor,
} from "./types";
import { safeWrite, setTaskEffort, toggleTaskDone } from "./writer";

/** What happened to each task, so the summary can be honest about it. */
type Outcome = "done" | "skipped" | "promoted";

/** The next size up, for "takes longer". Deep work has nowhere further to go. */
const NEXT_EFFORT: Record<Effort, Effort | null> = {
  light: "moderate",
  moderate: "heavy",
  heavy: "deep",
  deep: null,
};

export class SweepModal extends Modal {
  private queue: SmartTask[];
  private index = 0;
  private outcomes = new Map<string, Outcome>();

  private remaining: number;
  private ticker: ReturnType<typeof setInterval> | null = null;

  private bodyEl!: HTMLElement;
  private onFinish: () => void;
  private seconds: number;

  constructor(app: App, queue: SmartTask[], seconds: number, onFinish: () => void) {
    super(app);
    this.queue = queue;
    this.seconds = seconds;
    this.remaining = seconds;
    this.onFinish = onFinish;
  }

  onOpen(): void {
    this.modalEl.addClass("smart-todo-sweep-modal");
    const { contentEl } = this;
    contentEl.empty();
    this.bodyEl = contentEl.createDiv({ cls: "stw-sweep" });

    // Scoped to the modal, and only while it's open — a sweep owns Space, but
    // the moment it closes the key belongs to the editor again.
    this.scope.register([], " ", (evt) => {
      evt.preventDefault();
      void this.resolve("done");
    });
    this.scope.register([], "s", () => void this.resolve("skipped"));
    this.scope.register([], "l", () => void this.resolve("promoted"));

    this.start();
    this.paint();
  }

  onClose(): void {
    this.stop();
    this.contentEl.empty();
    this.onFinish();
  }

  private start(): void {
    this.stop();
    this.remaining = this.seconds;
    this.ticker = setInterval(() => {
      this.remaining = Math.max(0, this.remaining - 1);
      this.paintClock();
    }, 1000);
  }

  private stop(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  private get current(): SmartTask | null {
    return this.queue[this.index] ?? null;
  }

  /**
   * Record an outcome, write it if it has a side effect, and advance.
   *
   * "Takes longer" is the one that earns its keystroke: it moves the task up an
   * effort level, which means next time you ask for three minutes of work this
   * task correctly isn't offered. A skip changes nothing on disk — skipping is
   * allowed to be free, or you stop using it and start lying to the timer.
   */
  private async resolve(outcome: Outcome): Promise<void> {
    const task = this.current;
    if (!task) return;
    const key = `${task.filePath}:${task.lineNumber}`;

    if (outcome === "done") {
      await safeWrite(() => toggleTaskDone(this.app, task, true));
    } else if (outcome === "promoted") {
      const next = task.effort ? NEXT_EFFORT[task.effort] : "moderate";
      if (next) await safeWrite(() => setTaskEffort(this.app, task, next));
    }

    this.outcomes.set(key, outcome);
    this.index++;
    this.start();
    this.paint();
  }

  private paint(): void {
    this.bodyEl.empty();
    const task = this.current;

    if (!task) {
      this.stop();
      this.paintSummary();
      return;
    }

    const head = this.bodyEl.createDiv({ cls: "stw-sweep-head" });
    const badge = head.createSpan({ cls: "stw-sweep-badge" });
    setIcon(badge.createSpan({ cls: "stw-sweep-badge-icon" }), "zap");
    badge.createSpan({
      text: `Quick win ${this.index + 1} of ${this.queue.length}`,
    });

    this.bodyEl.createDiv({ cls: "stw-sweep-title", text: displayTitle(task.title) || "(untitled task)" });

    const chips = this.bodyEl.createDiv({ cls: "stw-sweep-chips" });
    const cat = categoryFor(task.project);
    if (cat) {
      const chip = chips.createSpan({ cls: "stw-chip" });
      chip.createSpan({
        cls: "stw-dot",
        attr: { style: `background:${CATEGORY_COLOR[cat]}` },
      });
      chip.createSpan({ text: CATEGORY_LABEL[cat] });
    }
    if (task.effort) {
      chips.createSpan({
        cls: "stw-chip",
        text: `${EFFORT_MINUTES[task.effort]} min`,
      });
    }

    this.paintClock();

    const actions = this.bodyEl.createDiv({ cls: "stw-sweep-actions" });
    this.actionBtn(actions, "Done", "Space", "is-primary", () => void this.resolve("done"));
    this.actionBtn(actions, "Skip", "S", "", () => void this.resolve("skipped"));
    this.actionBtn(actions, "Takes longer", "L", "", () => void this.resolve("promoted"));

    const next = task.effort ? NEXT_EFFORT[task.effort] : "moderate";
    this.bodyEl.createDiv({
      cls: "stw-sweep-hint",
      text: next
        ? `"Takes longer" moves it to the ${
            next === "deep" ? "deep work" : next === "heavy" ? "1 hour" : "15 minute"
          } lane and starts the next one.`
        : `"Takes longer" just moves on — this is already deep work.`,
    });
  }

  /**
   * Only the clock redraws on each tick. Repainting the whole modal once a
   * second would steal focus from the buttons and make the title flicker.
   */
  private paintClock(): void {
    let ring = this.bodyEl.querySelector(".stw-sweep-clock") as HTMLElement | null;
    if (!ring) {
      if (!this.current) return;
      ring = this.bodyEl.createDiv({ cls: "stw-sweep-clock" });
      // Keep the clock above the action row no matter when it's created.
      const actions = this.bodyEl.querySelector(".stw-sweep-actions");
      if (actions) this.bodyEl.insertBefore(ring, actions);
    }
    const pct = this.seconds > 0 ? this.remaining / this.seconds : 0;
    ring.style.setProperty("--sweep-pct", String(Math.max(0, Math.min(1, pct))));
    ring.toggleClass("is-over", this.remaining === 0);
    ring.empty();
    const mm = Math.floor(this.remaining / 60);
    const ss = String(this.remaining % 60).padStart(2, "0");
    ring.createDiv({ cls: "stw-sweep-time", text: `${mm}:${ss}` });
    ring.createDiv({
      cls: "stw-sweep-of",
      text: this.remaining === 0 ? "over" : `of ${Math.floor(this.seconds / 60)}:00`,
    });
  }

  private actionBtn(
    parent: HTMLElement,
    label: string,
    key: string,
    cls: string,
    onClick: () => void
  ): void {
    const btn = parent.createEl("button", { cls: `stw-sweep-btn ${cls}`.trim() });
    btn.createSpan({ text: label });
    btn.createSpan({ cls: "stw-sweep-key", text: key });
    btn.addEventListener("click", onClick);
  }

  private paintSummary(): void {
    const values = [...this.outcomes.values()];
    const done = values.filter((v) => v === "done").length;
    const promoted = values.filter((v) => v === "promoted").length;
    const skipped = values.filter((v) => v === "skipped").length;

    const cleared = this.queue
      .filter((t) => this.outcomes.get(`${t.filePath}:${t.lineNumber}`) === "done")
      .reduce((sum, t) => sum + (t.effort ? EFFORT_MINUTES[t.effort] : 0), 0);

    this.bodyEl.createDiv({ cls: "stw-sweep-title", text: "Sweep complete" });
    const stats = this.bodyEl.createDiv({ cls: "stw-sweep-stats" });
    const stat = (n: number, label: string): void => {
      const cell = stats.createDiv({ cls: "stw-sweep-stat" });
      cell.createDiv({ cls: "stw-sweep-stat-n", text: String(n) });
      cell.createDiv({ cls: "stw-sweep-stat-l", text: label });
    };
    stat(done, done === 1 ? "done" : "done");
    stat(promoted, "resized");
    stat(skipped, "skipped");

    this.bodyEl.createDiv({
      cls: "stw-sweep-hint",
      text:
        done > 0
          ? `About ${formatDuration(cleared)} of small stuff off the list.`
          : "Nothing cleared — the list is unchanged.",
    });

    const actions = this.bodyEl.createDiv({ cls: "stw-sweep-actions" });
    this.actionBtn(actions, "Close", "Esc", "is-primary", () => this.close());
  }
}
