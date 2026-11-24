// Smart ToDo — settings tab.
//
// One setting that matters: which files are managed. Everything else about the
// plugin is behaviour, not configuration.

import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import {
  addPathToScope,
  expandPathTokens,
  primaryManagedFile,
  scopeIncludesPath,
  weekNumber,
} from "./scope";
import {
  ACCENTS,
  Accent,
  DEFAULT_IMPORTANT_HEADINGS,
  DEFAULT_MANAGED_FILE,
  InlineSuggestMode,
  MODES,
  ViewMode,
} from "./types";
import type SmartTodoPlugin from "./main";

/**
 * The weekly-note path, as a token pattern.
 *
 * Matches John's vault (`2. Day Planners/Weeks/Week 48 of 2026.md`) and is
 * only a starting value — the button writes it into the managed-files box,
 * where it's editable like any other entry.
 */
const WEEK_PATTERN = "2. Day Planners/Weeks/Week {{week}} of {{year}}.md";

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
      const scope = this.plugin.scope;
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
          `Example: "${DEFAULT_MANAGED_FILE}, Projects/Tasks". ` +
          // Nobody should have to hand-type a path with an emoji in it.
          "To add a project note, right-click it and choose " +
          '"Smart ToDo: track tasks in this note" instead of typing it here.'
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

    // --- The weekly page ---------------------------------------------------
    //
    // The week page is the one note whose path moves. Tracking it by hand
    // means re-tracking it every Sunday and remembering to drop the old one,
    // and the failure when you forget is silent and bad: the panel keeps
    // showing last week's priorities as though they were this week's.
    el.createEl("h3", { text: "The weekly page" });
    el.createEl("p", {
      cls: "setting-item-description",
      text:
        "A tracked path can carry {{week}}, {{week:02}} and {{year}}, which " +
        "resolve each time the panel scans. Track the pattern once and the " +
        "right week's page is always the one being read.",
    });

    new Setting(el)
      .setName("Resolve {{week}} and {{year}} in tracked paths")
      .setDesc(
        "Off means a path with braces in it is skipped rather than treated as " +
          "a literal filename."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.weekTokensEnabled !== false).onChange(async (v) => {
          this.plugin.settings.weekTokensEnabled = v;
          await this.plugin.saveSettings();
          renderSummary();
          this.plugin.refreshViews();
        })
      );

    new Setting(el)
      .setName("Weeks start on")
      .setDesc(
        "Which convention your week-page numbering follows. Sunday is the US " +
          "convention (week 1 contains Jan 1); Monday is ISO-8601. These " +
          "disagree by one for much of the year, and the wrong one points at " +
          "an adjacent week's file — which looks like the feature not working. " +
          `Right now: week ${weekNumber(new Date(), this.plugin.settings.weekStart ?? "sunday")}.`
      )
      .addDropdown((dd) => {
        dd.addOption("sunday", "Sunday (US)");
        dd.addOption("monday", "Monday (ISO-8601)");
        dd.setValue(this.plugin.settings.weekStart ?? "sunday").onChange(async (v) => {
          this.plugin.settings.weekStart = v as "sunday" | "monday";
          await this.plugin.saveSettings();
          renderSummary();
          this.plugin.refreshViews();
          this.display();
        });
      });

    // Nobody should hand-type a path with `{{` in it to find out whether it
    // resolves. This writes the pattern and says which file it just hit.
    new Setting(el)
      .setName("Track this week's page")
      .setDesc(
        `Adds "${WEEK_PATTERN}" to the managed files above. Edit the pattern ` +
          "there if your weekly notes live somewhere else."
      )
      .addButton((btn) =>
        btn
          .setButtonText(
            scopeIncludesPath(this.plugin.settings.managedFiles, WEEK_PATTERN)
              ? "Already tracked"
              : "Track it"
          )
          .onClick(async () => {
            this.plugin.settings.managedFiles = addPathToScope(
              this.plugin.settings.managedFiles,
              WEEK_PATTERN
            );
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
            const resolved = expandPathTokens(
              WEEK_PATTERN,
              new Date(),
              this.plugin.settings.weekStart ?? "sunday"
            );
            const exists = !!this.app.vault.getAbstractFileByPath(resolved);
            new Notice(
              exists
                ? `Smart ToDo: tracking ${resolved}.`
                : `Smart ToDo: pattern added, but ${resolved} doesn't exist yet — ` +
                  "check the folder and the week-start setting.",
              8000
            );
            this.display();
          })
      );

    new Setting(el)
      .setName("Headings that mean important")
      .setDesc(
        "Comma-separated. A task under a heading containing any of these counts " +
          "as important unless the task says otherwise itself — the judgment on " +
          '"Focus this week, what is Important and Urgent" was made once for the ' +
          "whole list rather than once per line. The panel marks inferred " +
          "importance with § so you can see where it came from."
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(DEFAULT_IMPORTANT_HEADINGS.join(", "))
          .setValue((this.plugin.settings.importantHeadings ?? []).join(", "))
          .onChange(async (value) => {
            this.plugin.settings.importantHeadings = value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
        text.inputEl.rows = 2;
        text.inputEl.addClass("smart-todo-scope-input");
      });

    new Setting(el)
      .setName("Split tracked notes by heading")
      .setDesc(
        "Inside a tracked note, group its tasks under the heading each sits " +
          "below. On a weekly page those sections are most of the meaning."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.groupByHeading !== false).onChange(async (v) => {
          this.plugin.settings.groupByHeading = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        })
      );

    el.createEl("h3", { text: "Display" });

    new Setting(el)
      .setName("Metadata as chips in the editor")
      .setDesc(
        "Show [due:: …], [effort:: …] and the legacy emoji as small chips while " +
          "editing a note. Put the cursor on a line to see the raw text — " +
          "nothing is hidden from editing, and the file on disk is unchanged."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.metadataChips !== false).onChange(async (v) => {
          this.plugin.settings.metadataChips = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(el)
      .setName("Inline / menu")
      .setDesc(
        "Type a line, then \"/\" at the end of it, to turn it into a task — " +
          "plain, important, or due in two days (which is what makes it urgent). " +
          "It fires on a bare keystroke, so restrict or disable it here."
      )
      .addDropdown((d) =>
        d
          .addOptions({
            everywhere: "Every note",
            tracked: "Tracked notes only",
            off: "Off",
          })
          .setValue(this.plugin.settings.inlineSuggest ?? "everywhere")
          .onChange(async (v) => {
            this.plugin.settings.inlineSuggest = v as InlineSuggestMode;
            await this.plugin.saveSettings();
          })
      );

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
