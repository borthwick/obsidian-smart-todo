// Smart ToDo — "Add task" prompt for the command palette path.
//
// The Today view has its own always-visible input; this exists so capture also
// works from a hotkey without the view open.

import { App, Modal, Setting } from "obsidian";

export class AddTaskModal extends Modal {
  private title = "";

  constructor(app: App, private onSubmit: (title: string) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Add task" });

    const commit = (): void => {
      const value = this.title.trim();
      if (!value) return;
      this.close();
      this.onSubmit(value);
    };

    new Setting(contentEl).setName("Task").addText((text) => {
      text.setPlaceholder("What needs doing?").onChange((value) => {
        this.title = value;
      });
      text.inputEl.addClass("smart-todo-modal-input");
      text.inputEl.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          evt.preventDefault();
          commit();
        }
      });
      // Modal focus lands on the container by default; put the caret in the box.
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Add").setCta().onClick(commit)
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
