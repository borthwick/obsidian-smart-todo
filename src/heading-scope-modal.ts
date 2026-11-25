// Smart ToDo — pick one section of a note to track.
//
// Heading-scoped entries are written as `path.md#Heading`, and the headings
// that need them are the worst ones to retype: a Kanban column reading
// `Important  .. or (urgent)`, a meeting note's `Follow-ups / JB`. So the
// settings box is never the way in — this is. It lists the note's own
// headings with a live count of the open tasks under each, because the only
// question being asked is "which of these is the work?"

import { App, FuzzySuggestModal, Notice } from "obsidian";
import { ARCHIVE_HEADING_RE } from "./parser";
import { SPIRAL_ICON_ID } from "./task-suggest";

export interface HeadingChoice {
  /** The heading text as written in the note, or null for "the whole note". */
  heading: string | null;
  /** Open checkboxes beneath it. */
  open: number;
}

/**
 * Headings of a note, each with the number of open tasks under it.
 *
 * Deliberately a light second pass over the raw text rather than a call into
 * the parser: this has to list headings with *no* tasks too (so a mistake is
 * visible as "0 open" rather than a missing row), and it has to run on a note
 * that isn't in scope yet, which is every note this modal opens on.
 *
 * Code fences are tracked for the same reason the parser tracks them — John's
 * week page ends in a ```base block whose contents look like task lines — and
 * `## Archive` is left out entirely, because the parser can't see it either.
 * A count here that the panel then doesn't honour is worse than no count.
 */
export function headingsWithCounts(content: string): HeadingChoice[] {
  const out: HeadingChoice[] = [];
  let current: HeadingChoice | null = null;
  let preamble = 0;
  let inFence = false;
  let archived = false;

  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const h = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const text = h[2]
        .replace(/<[^>]+>/g, "")
        .replace(/[*_`]/g, "")
        .trim();
      if (ARCHIVE_HEADING_RE.test(text)) {
        current = null;
        archived = true;
        continue;
      }
      archived = false;
      current = { heading: text || null, open: 0 };
      if (current.heading) out.push(current);
      continue;
    }
    if (archived) continue;
    if (!/^\s*(?:[-*+]|\d+[.)])\s+\[ \]/.test(line)) continue;
    if (current?.heading) current.open += 1;
    else preamble += 1;
  }

  // Whole-note first: it's the existing behaviour, and offering only sections
  // would make "actually I want all of it" feel unsupported.
  const whole: HeadingChoice = {
    heading: null,
    open: preamble + out.reduce((n, c) => n + c.open, 0),
  };
  return [whole, ...out];
}

export class HeadingScopeModal extends FuzzySuggestModal<HeadingChoice> {
  constructor(
    app: App,
    private readonly fileName: string,
    private readonly choices: HeadingChoice[],
    private readonly onPick: (heading: string | null) => void | Promise<void>
  ) {
    super(app);
    this.setPlaceholder(`Track which part of ${fileName}?`);
    this.setInstructions([
      { command: "↑↓", purpose: "navigate" },
      { command: "↵", purpose: "track this section" },
      { command: "esc", purpose: "cancel" },
    ]);
    this.modalEl.addClass("smart-todo-heading-scope");
  }

  getItems(): HeadingChoice[] {
    return this.choices;
  }

  getItemText(item: HeadingChoice): string {
    const label = item.heading ?? "The whole note";
    return `${label} — ${item.open} open`;
  }

  onChooseItem(item: HeadingChoice): void {
    void this.onPick(item.heading);
  }

  static open(
    app: App,
    fileName: string,
    content: string,
    onPick: (heading: string | null) => void | Promise<void>
  ): void {
    const choices = headingsWithCounts(content);
    if (choices.length <= 1) {
      // No headings at all — there is no section to choose, and a one-row
      // picker reading "The whole note" is a dialog that wastes a keystroke.
      new Notice(`Smart ToDo: ${fileName} has no headings to scope to.`, 4000);
      void onPick(null);
      return;
    }
    const modal = new HeadingScopeModal(app, fileName, choices, onPick);
    modal.open();
  }
}

/** Icon id re-exported so the menu item and the modal can't drift apart. */
export const HEADING_SCOPE_ICON = SPIRAL_ICON_ID;
