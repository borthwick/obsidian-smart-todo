// Smart ToDo — settings tab.
//
// One setting that matters: which files are managed. Everything else about the
// plugin is behaviour, not configuration.

import { App, PluginSettingTab, Setting } from "obsidian";
import { parseScope, primaryManagedFile } from "./scope";
import {
  ACCENTS,
  Accent,
  DEFAULT_MANAGED_FILE,
  MODES,
  ViewMode,
} from "./types";
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

    // The inbox is a *triage* boundary, not just a second file. Open tasks
    // here are pulled out of the main list entirely and shown in their own
    // bucket with Keep / Edit / Drop — so a voice capture lands somewhere
    // visible and gets a decision, instead of silently joining forty others.
    new Setting(el)
      .setName("Inbox file")
      .setDesc(
        "Optional. Open tasks in this file are treated as untriaged captures: " +
          "they show in an Inbox bucket at the top of the panel and nowhere " +
          `else. Keep moves one into ${primaryManagedFile(this.plugin.scope)}. ` +
          "Leave blank to turn the Inbox off."
      )
      .addText((text) => {
        text
          .setPlaceholder("Task inbox.md")
          .setValue(this.plugin.settings.inboxFile)
          .onChange(async (value) => {
            this.plugin.settings.inboxFile = value;
            await this.plugin.saveSettings();
            renderInboxWarning();
            this.plugin.refreshViews();
          });
        text.inputEl.addClass("smart-todo-scope-input");
      });

    // A path outside the managed scope is never scanned, so the Inbox would
    // sit permanently empty with no hint as to why. Say it, and offer the fix.
    const inboxWarning = el.createDiv();
    const renderInboxWarning = (): void => {
      inboxWarning.empty();
      if (!this.plugin.inboxOutOfScope) return;
      const path = this.plugin.inboxPath!;
      inboxWarning.createDiv({
        cls: "setting-item-description",
        text:
          `⚠ ${path} isn't in the managed scope above, so it's never scanned — ` +
          "the Inbox will stay empty.",
      });
      new Setting(inboxWarning)
        .setName("Add the inbox to managed files")
        .addButton((btn) =>
          btn.setButtonText("Add to scope").onClick(async () => {
            const current = this.plugin.settings.managedFiles.trim();
            this.plugin.settings.managedFiles = current ? `${current}, ${path}` : path;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
            this.display();
          })
        );
    };
    renderInboxWarning();

    el.createEl("h3", { text: "Display" });

    // The accent is a colour, so the control is the colour — a dropdown of
    // colour *names* makes you click twice to see what you picked.
    const accentSetting = new Setting(el)
      .setName("Accent")
      .setDesc("Tints the panel: titles, the mark, the active chips, the sweep ring.");
    const accentRow = accentSetting.controlEl.createDiv({ cls: "smart-todo-accent-row" });
    const paintAccents = (): void => {
      accentRow.empty();
      for (const id of Object.keys(ACCENTS) as Accent[]) {
        const def = ACCENTS[id];
        const btn = accentRow.createEl("button", { cls: "smart-todo-accent" });
        btn.style.setProperty("--swatch", def.base);
        btn.createSpan({ cls: "smart-todo-accent-swatch" });
        btn.createSpan({ text: def.label });
        if (this.plugin.settings.accent === id) btn.addClass("is-active");
        btn.addEventListener("click", async () => {
          this.plugin.settings.accent = id;
          await this.plugin.saveSettings();
          paintAccents();
          // A full rebuild, not a refresh: the accent lives in custom
          // properties on the root element, which only onOpen sets.
          this.plugin.rebuildViews();
        });
      }
    };
    paintAccents();

    new Setting(el)
      .setName("Opens in")
      .setDesc(
        "Which mode the panel starts in. Focus groups by Eisenhower quadrant, " +
          "Sweep runs the timer, Lanes shows the effort board."
      )
      .addDropdown((dd) => {
        for (const m of MODES) dd.addOption(m.id, m.label);
        dd.setValue(this.plugin.settings.defaultMode).onChange(async (value) => {
          this.plugin.settings.defaultMode = value as ViewMode;
          await this.plugin.saveSettings();
        });
      });

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

    el.createEl("h3", { text: "Sweep" });
    el.createEl("p", {
      cls: "setting-item-description",
      text:
        "A sweep is a timed run through the three-minute tasks: one at a " +
        "time, with Done / Skip / Takes longer on the keyboard.",
    });

    new Setting(el)
      .setName("Offer a sweep in the list")
      .setDesc(
        "Shows a \"you have N quick wins\" banner inside the task list when " +
          "there are at least two. Turn this off if you'd rather only reach " +
          "Sweep from the mode row."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSweepBanner)
          .onChange(async (value) => {
            this.plugin.settings.showSweepBanner = value;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
      );

    new Setting(el)
      .setName("Seconds per task")
      .setDesc(
        "The countdown for each task in a sweep. Three minutes is the point " +
          "of the light-effort tag, so that's the default; going over doesn't " +
          "stop you, it just turns the clock red."
      )
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.sweepSeconds))
          .onChange(async (value) => {
            const n = Number(value);
            if (Number.isFinite(n) && n >= 15) {
              this.plugin.settings.sweepSeconds = Math.floor(n);
              await this.plugin.saveSettings();
            }
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
