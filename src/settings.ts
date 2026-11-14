// Smart ToDo — settings tab.
//
// One setting that matters: which files are managed. Everything else about the
// plugin is behaviour, not configuration.

import { App, PluginSettingTab, Setting } from "obsidian";
import { parseScope, primaryManagedFile } from "./scope";
import { DEFAULT_MANAGED_FILE } from "./types";
import type SmartTodoPlugin from "./main";

export class SmartTodoSettingTab extends PluginSettingTab {
  plugin: SmartTodoPlugin;

  constructor(app: App, plugin: SmartTodoPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const el = this.containerEl;
    el.empty();
    el.createEl("h2", { text: "Smart ToDo" });

    el.createEl("h3", { text: "Managed scope" });
    el.createEl("p", {
      cls: "setting-item-description",
      text:
        "Smart ToDo only reads the files listed here. Nothing else in the vault " +
        "is scanned — old meeting notes and planners full of stale checkboxes " +
        "stay invisible.",
    });

    // A resolved-scope readout under the input: the matching rules (file vs
    // folder, recursive) are easy to get wrong silently, so show the outcome.
    const summary = el.createDiv({ cls: "smart-todo-scope-summary" });
    const renderSummary = (): void => {
      summary.empty();
      const scope = parseScope(this.plugin.settings.managedFiles);
      const matches = this.app.vault
        .getMarkdownFiles()
        .filter((f) => this.plugin.isInManagedScope(f.path));

      if (scope.usedFallback) {
        summary.createDiv({
          cls: "setting-item-description",
          text: `No scope set — falling back to ${DEFAULT_MANAGED_FILE}.`,
        });
      }
      for (const entry of scope.entries) {
        summary.createDiv({
          cls: "setting-item-description",
          text:
            entry.kind === "folder"
              ? `📁 ${entry.path}/ — all .md files beneath it`
              : `📄 ${entry.path}`,
        });
      }
      summary.createDiv({
        cls: "setting-item-description",
        text: `Currently matching ${matches.length} file${
          matches.length === 1 ? "" : "s"
        } in the vault. New tasks go to ${primaryManagedFile(scope)}.`,
      });
    };

    new Setting(el)
      .setName("Managed files")
      .setDesc(
        "Comma-separated. An entry ending in .md is a single file; anything " +
          "else is treated as a folder and all .md files under it are included. " +
          `Example: "${DEFAULT_MANAGED_FILE}, Projects/Tasks"`
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(DEFAULT_MANAGED_FILE)
          .setValue(this.plugin.settings.managedFiles)
          .onChange(async (value) => {
            this.plugin.settings.managedFiles = value;
            await this.plugin.saveSettings();
            renderSummary();
            this.plugin.refreshViews();
          });
        text.inputEl.rows = 3;
        text.inputEl.addClass("smart-todo-scope-input");
      });

    el.appendChild(summary);
    renderSummary();

    new Setting(el)
      .setName("Create the managed file")
      .setDesc(
        "Creates the file new tasks are appended to, if it doesn't exist yet."
      )
      .addButton((btn) =>
        btn.setButtonText("Create now").onClick(async () => {
          await this.plugin.ensurePrimaryFile();
          renderSummary();
        })
      );
  }
}
