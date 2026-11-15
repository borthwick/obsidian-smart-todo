// Smart ToDo — settings tab.
//
// One setting that matters: which files are managed. Everything else about the
// plugin is behaviour, not configuration.

import { App, PluginSettingTab, Setting } from "obsidian";
import { parseScope, primaryManagedFile } from "./scope";
import { DEFAULT_MANAGED_FILE, Layout } from "./types";
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

    el.createEl("h3", { text: "Display" });

    new Setting(el)
      .setName("Default layout")
      .setDesc("Card rows, or an Onda-style sortable table.")
      .addDropdown((dd) =>
        dd
          .addOption("card", "Cards")
          .addOption("table", "Table")
          .setValue(this.plugin.settings.defaultLayout)
          .onChange(async (value) => {
            this.plugin.settings.defaultLayout = value as Layout;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
      );

    new Setting(el)
      .setName("Pushes warning threshold")
      .setDesc(
        "The pushes badge turns amber at or above this count — your " +
          "procrastination signal. Set higher to only flag chronic avoiders."
      )
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.pushesWarnThreshold))
          .onChange(async (value) => {
            const n = Number(value);
            if (Number.isFinite(n) && n >= 1) {
              this.plugin.settings.pushesWarnThreshold = Math.floor(n);
              await this.plugin.saveSettings();
              this.plugin.refreshViews();
            }
          })
      );

    new Setting(el)
      .setName("Group Quickies")
      .setDesc(
        "Collect light-effort tasks into a \"Quickies · 3 minutes or less\" " +
          "section at the foot of the list. Effort is still tagged on every " +
          "task either way — this only changes what the panel shows."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.groupQuickies)
          .onChange(async (value) => {
            this.plugin.settings.groupQuickies = value;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
      );

    el.createEl("h3", { text: "Categories" });
    el.createEl("p", {
      cls: "setting-item-description",
      text:
        "Tasks carry one of three categories — Betaworks, Personal, Health — " +
        "stored in the same [project:: …] field, so Dataview and Tasks " +
        "queries keep working. Imported tasks with older project names can be " +
        "folded onto the three in one pass; you'll see every change first.",
    });

    new Setting(el)
      .setName("Fold projects into categories")
      .setDesc(
        "Previews the retag, then applies it one line at a time. Tasks with " +
          "no project are left alone."
      )
      .addButton((btn) =>
        btn
          .setButtonText("Review changes")
          .onClick(() => void this.plugin.openCategoryMigration())
      );
  }
}
