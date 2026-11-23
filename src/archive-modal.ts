// Smart ToDo — the clean-slate confirmation.
//
// This is the one command in the plugin that rewrites a whole file, so it is
// also the only one that asks first. The dialog's job is to make the number
// concrete and say exactly what happens to the lines, because "archive the
// backlog" sounds reversible and a user who assumed wrong finds out too late.

import { App, Modal } from "obsidian";

export class ArchiveBacklogModal extends Modal {
  constructor(
    app: App,
    private path: string,
    private count: number,
    private samples: string[],
    private onApply: () => void | Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Archive the backlog" });

    const name = this.path.split("/").pop() ?? this.path;

    if (this.count === 0) {
      contentEl.createDiv({
        cls: "smart-todo-edit-hint",
        text: `No open tasks in ${name}. Nothing to archive.`,
      });
      const done = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
      done.createEl("button", { cls: "mod-cta", text: "Close" })
        .addEventListener("click", () => this.close());
      return;
    }

    contentEl.createDiv({
      cls: "smart-todo-edit-hint",
      text:
        `${this.count} open task${this.count === 1 ? "" : "s"} in ${name} ` +
        `will move to an "## Archive" section at the foot of the note, ` +
        `stamped with today's date. Sub-tasks travel with their parent.`,
    });
    contentEl.createDiv({
      cls: "smart-todo-edit-hint",
      text:
        "Nothing is deleted and nothing is marked done — the lines keep their " +
        "text, dates and ids, they just stop showing in the panel. To bring one " +
        "back, cut it out of the Archive section.",
    });

    if (this.samples.length > 0) {
      const list = contentEl.createDiv({ cls: "smart-todo-migrate-list" });
      for (const title of this.samples) {
        list.createDiv({ cls: "smart-todo-migrate-from", text: title });
      }
      if (this.count > this.samples.length) {
        list.createDiv({
          cls: "smart-todo-edit-hint",
          text: `…and ${this.count - this.samples.length} more.`,
        });
      }
    }

    const actions = contentEl.createDiv({ cls: "smart-todo-modal-actions" });
    actions.createEl("button", { text: "Cancel" })
      .addEventListener("click", () => this.close());
    const apply = actions.createEl("button", {
      cls: "mod-cta",
      text: `Archive ${this.count}`,
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
