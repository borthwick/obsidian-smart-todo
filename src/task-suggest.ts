// Inline `/` task suggestions.
//
// Typing `/` at the end of a line you've just written opens a short menu that
// turns that line into a task — optionally marked important, or dated two days
// out so it lands as urgent. It's the one capture surface that costs nothing to
// reach, because you're already typing the sentence.
//
// The Tasks plugin has a version of this, and it's the reason John asked: his
// muscle memory expects a menu on `/`. What his version does is *append emoji
// tokens* to an existing task line (📅, ⏫). This one does the opposite job —
// it makes the line a task in the first place, and writes the 0.11 plain-word
// notation. Nothing here emits emoji.

import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  Notice,
  TFile,
  setIcon,
} from "obsidian";
import { addDays, formatDate, startOfToday } from "./parser";
import { setInlineField } from "./writer";
import { URGENT_WINDOW_DAYS } from "./filters";
import type SmartTodoPlugin from "./main";

/** Indent + bullet + checkbox — the line is already a task. */
const TASK_PREFIX_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[.\]\s*)/;
/** Indent + bullet, no checkbox — a plain list item. */
const BULLET_PREFIX_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)/;
/** Leading whitespace, for a line that's neither. */
const INDENT_RE = /^(\s*)/;

export type TaskActionId = "plain" | "important" | "urgent";

interface TaskAction {
  id: TaskActionId;
  /**
   * The whole row. One line, lowercase, no verb and no second line of
   * explanation — the menu is three choices deep and the spiral's colour
   * already says which one you're on.
   */
  label: string;
  /** Words the typed query is matched against. */
  keywords: string[];
}

/** `2` → `two`, so the label reads as a sentence. Falls back to digits. */
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
const urgentWindow = NUMBER_WORDS[URGENT_WINDOW_DAYS] ?? String(URGENT_WINDOW_DAYS);

export const ACTIONS: TaskAction[] = [
  {
    id: "plain",
    label: "task, triage later",
    keywords: ["add", "task", "todo", "plain", "triage"],
  },
  {
    id: "important",
    label: "important",
    keywords: ["important", "priority", "high", "matters"],
  },
  {
    id: "urgent",
    label: `urgent (due in ${urgentWindow} days)`,
    keywords: ["urgent", "due", "soon", "now", "today"],
  },
];

type SuggestItem = TaskAction;

/**
 * The Smart ToDo mark, drawn on every row.
 *
 * Not decoration: with the Tasks plugin still installed, two different `/`
 * menus can answer the same keystroke, and the only way to know whose list you
 * are looking at before you press Enter is the glyph on the row.
 *
 * Obsidian wraps registered icons in a 100×100 viewBox; the source art is a
 * 24-unit spiral, hence the scale.
 */
export const SPIRAL_ICON_ID = "smart-todo-spiral";
export const SPIRAL_ICON_SVG = `<g transform="scale(4.1667)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12 m 0 0 c 0.5 0 1 0 1 -1 c 0 -1.5 -1.5 -1.5 -2 -1 c -1.5 1 -1.5 3.5 0.5 4 c 3 0.5 4 -3 2 -5 c -3 -3 -7 0 -6 4 c 1 5 8 6 10 1 c 2 -5 -3 -11 -9 -9 c -6 2 -6 10 0 12" /></g>`;

/**
 * Decide whether a `/` is an invitation or an accident.
 *
 * This fires on a bare keystroke in any note, so every false positive is a menu
 * covering text the user is in the middle of writing. The cheap exclusions
 * below cover what `/` is otherwise used for: dates (`11/24`), paths and URLs
 * (`https://`, `src/main.ts`), and fractions.
 */
export function triggerQuery(lineUpToCursor: string): string | null {
  const m = /\/([A-Za-z]*)$/.exec(lineUpToCursor);
  if (!m) return null;

  const slashAt = lineUpToCursor.length - m[0].length;
  const before = lineUpToCursor.slice(0, slashAt);

  // Nothing to turn into a task yet.
  if (!before.trim()) return null;
  // A second slash, a protocol, or a path segment.
  const prev = before.at(-1) ?? "";
  if (prev === "/" || prev === ":" || prev === ".") return null;
  // More than one slash in the word under the cursor means it's a path or a
  // compound (`src/main.ts/`, `and/or/`), not a sentence being ended.
  const word = /\S*$/.exec(lineUpToCursor)?.[0] ?? "";
  if ((word.match(/\//g) ?? []).length > 1) return null;
  // A date or a fraction.
  if (/\d\s*$/.test(before)) return null;
  // Already inside a link or embed.
  if (/https?:$|\]\($/.test(before.trimEnd())) return null;

  return m[1];
}

/** True if the cursor line sits inside a fenced code block or frontmatter. */
function inVerbatimRegion(editor: Editor, line: number): boolean {
  let fenced = false;
  for (let i = 0; i < line; i++) {
    const text = editor.getLine(i);
    if (/^\s*(```|~~~)/.test(text)) fenced = !fenced;
    // Frontmatter: a `---` on line 0 opens a block that ends at the next one.
    if (i === 0 && text.trim() === "---") fenced = true;
    else if (fenced && i > 0 && text.trim() === "---" && editor.getLine(0).trim() === "---") {
      fenced = false;
    }
  }
  return fenced;
}

/**
 * Rewrite one line for the chosen action.
 *
 * Exported because this is the part worth testing without an editor: the
 * prefix rules (plain text vs bullet vs existing checkbox) are where a capture
 * menu silently produces a line the parser won't read.
 */
export function applyAction(line: string, action: TaskActionId, today = startOfToday()): string {
  let body = line.replace(/\s+$/, "");

  if (!TASK_PREFIX_RE.test(body)) {
    const bullet = BULLET_PREFIX_RE.exec(body);
    if (bullet) {
      body = `${bullet[1]}[ ] ${body.slice(bullet[1].length)}`;
    } else {
      const indent = INDENT_RE.exec(body)?.[1] ?? "";
      body = `${indent}- [ ] ${body.slice(indent.length)}`;
    }
  }

  if (action === "important") return setInlineField(body, "important", "true");
  if (action === "urgent") {
    return setInlineField(body, "due", formatDate(addDays(today, URGENT_WINDOW_DAYS)));
  }
  return body;
}

export class TaskSuggest extends EditorSuggest<SuggestItem> {
  constructor(app: App, private plugin: SmartTodoPlugin) {
    super(app);
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    file: TFile | null
  ): EditorSuggestTriggerInfo | null {
    const mode = this.plugin.settings.inlineSuggest;
    if (mode === "off") return null;
    if (mode === "tracked" && !(file && this.plugin.isInManagedScope(file.path))) return null;

    const upToCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
    const query = triggerQuery(upToCursor);
    if (query === null) return null;
    if (inVerbatimRegion(editor, cursor.line)) return null;

    return {
      start: { line: cursor.line, ch: cursor.ch - query.length - 1 },
      end: cursor,
      query,
    };
  }

  getSuggestions(context: EditorSuggestContext): SuggestItem[] {
    const q = context.query.toLowerCase();
    return ACTIONS.filter(
      (a) => !q || a.keywords.some((k) => k.startsWith(q)) || a.id.startsWith(q)
    );
  }

  renderSuggestion(item: SuggestItem, el: HTMLElement): void {
    el.addClass("smart-todo-suggest");
    const icon = el.createSpan({ cls: `smart-todo-suggest-icon is-${item.id}` });
    setIcon(icon, SPIRAL_ICON_ID);
    el.createDiv({ cls: "smart-todo-suggest-title", text: item.label });
  }

  selectSuggestion(item: SuggestItem): void {
    const ctx = this.context;
    if (!ctx) return;
    const { editor, start, end, file } = ctx;

    // Drop the `/query` that opened the menu, then rewrite what's left.
    const line = editor.getLine(start.line);
    const stripped = line.slice(0, start.ch) + line.slice(end.ch);
    const next = applyAction(stripped, item.id);

    editor.replaceRange(
      next,
      { line: start.line, ch: 0 },
      { line: start.line, ch: line.length }
    );
    editor.setCursor({ line: start.line, ch: next.length });

    this.close();
    void this.trackOnCapture(file);
  }

  /**
   * Capturing into a note tracks that note.
   *
   * 0.12 only *warned* that an untracked note wouldn't show, with a link to fix
   * it. That was wrong in practice: the task is written, the toast goes away,
   * and what's left is a real markdown checkbox the panel silently refuses to
   * list — which reads as the plugin being broken, and sends you to the search
   * box to type the task a second time.
   *
   * Deliberately choosing "task" in this plugin's own menu *is* the request to
   * manage it, so scope follows the capture. Announced and undoable, because it
   * changes a setting the user didn't open.
   */
  private async trackOnCapture(file: TFile | null): Promise<void> {
    if (!file || this.plugin.isInManagedScope(file.path)) return;

    await this.plugin.toggleTracked(file.path, { silent: true });

    const frag = document.createDocumentFragment();
    frag.createDiv({ text: `Now tracking ${file.basename}.` });
    const link = frag.createEl("a", { text: "Undo", href: "#" });
    link.addEventListener("click", (evt) => {
      evt.preventDefault();
      void this.plugin.toggleTracked(file.path);
    });
    new Notice(frag, 6000);
  }
}
