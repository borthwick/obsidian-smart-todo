// Smart ToDo — metadata chips for Live Preview.
//
// The 0.11 vocabulary change moves every field to a plain `[word:: value]`,
// which is readable, greppable, and survives the plugin being uninstalled —
// and also three times as wide as the emoji it replaced. `📅 2026-11-28`
// becomes `[due:: 2026-11-28]`, and a line carrying five fields reads like a
// config file with a sentence buried in it.
//
// So the notation is plain in the file and compact in the editor: this
// extension replaces each token with a small chip, and reveals the literal
// text the moment the cursor enters that line. Nothing is hidden from editing
// — put the cursor on the line and you're looking at exactly what's on disk.
//
// Why a CodeMirror extension and not a markdown post-processor: post-processors
// only run in Reading view, and the whole point is that the week page is *typed
// in*. This is Live Preview, where the work happens.

import { Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";

/** The fields worth a chip, in the order they're drawn if several are present. */
const CHIP_FIELDS: Record<string, { label: string; cls: string }> = {
  due: { label: "due", cls: "stw-chip-due" },
  defer: { label: "defer", cls: "stw-chip-defer" },
  done: { label: "done", cls: "stw-chip-done" },
  dropped: { label: "dropped", cls: "stw-chip-done" },
  effort: { label: "", cls: "stw-chip-effort" },
  project: { label: "", cls: "stw-chip-project" },
  priority: { label: "", cls: "stw-chip-priority" },
  important: { label: "", cls: "stw-chip-important" },
  pushes: { label: "", cls: "stw-chip-pushes" },
  assigned: { label: "", cls: "stw-chip-assigned" },
};

/**
 * Fields a chip would actively obscure rather than tidy.
 *
 * `[stream:: 7f3c-aa]` and `[morgen:: <uuid>]` are correlation keys — the sync
 * scripts find a line by them, so when something has gone wrong the raw value
 * is exactly what you need to see. They render as a small dot instead: present,
 * clearly machine-owned, one click away from the real text.
 */
const ID_FIELDS = new Set(["stream", "morgen", "id", "blockedBy", "blocked-by"]);

/** `[key:: value]`, the one notation this version writes. */
const FIELD_RE = /\[([A-Za-z][\w-]*)\s*::\s*([^\]]*)\]/g;

/**
 * Legacy emoji tokens, chipped so a converted line and an un-converted one
 * look the same in the editor.
 *
 * Reading emoji is permanent (the OmniFocus import and months of week pages
 * are full of it) and conversion only happens when a line is touched, so for a
 * long while the vault holds both. Showing them identically means the
 * transition is invisible — which is the point. `u` flag because a character
 * class of emoji without it matches lead surrogates and splits other emoji in
 * half.
 */
const EMOJI_RE =
  /(📅|⏳|✅|🛫|➕|❌)\s*(\d{4}-\d{2}-\d{2})|(🔺|⏫|🔼|🔽|⏬)/gu;

const EMOJI_FIELD: Record<string, string> = {
  "📅": "due",
  "⏳": "defer",
  "✅": "done",
  "🛫": "start",
  "➕": "added",
  "❌": "cancelled",
};

const EMOJI_PRIORITY: Record<string, string> = {
  "🔺": "highest",
  "⏫": "high",
  "🔼": "medium",
  "🔽": "low",
  "⏬": "lowest",
};

/** Dates render as "Fri 28" / "28 Nov" rather than the full ISO string. */
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

interface ChipSpec {
  /** Short text in the chip. Empty renders as a dot. */
  text: string;
  /** Full raw token, shown on hover — the chip never hides the truth. */
  title: string;
  cls: string;
}

/** What a `[key:: value]` field looks like once it's a chip. */
function fieldChip(key: string, value: string, raw: string): ChipSpec | null {
  const lower = key.toLowerCase();
  const v = value.trim();

  if (ID_FIELDS.has(key) || ID_FIELDS.has(lower)) {
    return { text: "", title: raw, cls: "stw-chip-id" };
  }

  const def = CHIP_FIELDS[lower];
  if (!def) return null;

  // `[important:: true]` is a flag, not a value: it reads as "important", and
  // the explicit false reads as "not important" rather than "important: no".
  if (lower === "important") {
    const on = /^(true|yes|1)$/i.test(v);
    return {
      text: on ? "important" : "not important",
      title: raw,
      cls: on ? "stw-chip-important" : "stw-chip-unimportant",
    };
  }

  if (lower === "pushes") {
    return { text: `↻${v}`, title: raw, cls: def.cls };
  }

  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const shown = isDate ? shortDate(v) : v;
  return {
    text: def.label ? `${def.label} ${shown}` : shown,
    title: raw,
    cls: def.cls,
  };
}

class ChipWidget extends WidgetType {
  constructor(private spec: ChipSpec) {
    super();
  }

  /**
   * Two chips are interchangeable when they'd render identically. CodeMirror
   * reuses the DOM when this returns true, so without it every keystroke on
   * the line rebuilds every chip on it.
   */
  eq(other: ChipWidget): boolean {
    return (
      other.spec.text === this.spec.text &&
      other.spec.cls === this.spec.cls &&
      other.spec.title === this.spec.title
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = `stw-chip ${this.spec.cls}`;
    el.setAttr("title", this.spec.title);
    if (this.spec.text) {
      el.textContent = this.spec.text;
    } else {
      el.addClass("stw-chip-dot");
    }
    return el;
  }

  /**
   * Let clicks through to the editor so clicking a chip puts the cursor on the
   * line — which reveals the raw text. That's the whole interaction: click to
   * see what's really there.
   */
  ignoreEvent(): boolean {
    return false;
  }
}

/** Decoration ranges for one line of text starting at `from`. */
function chipsForLine(
  text: string,
  from: number,
  out: Array<{ start: number; end: number; spec: ChipSpec }>
): void {
  FIELD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FIELD_RE.exec(text))) {
    const spec = fieldChip(m[1], m[2], m[0]);
    if (spec) out.push({ start: from + m.index, end: from + m.index + m[0].length, spec });
  }

  EMOJI_RE.lastIndex = 0;
  while ((m = EMOJI_RE.exec(text))) {
    const spec = m[3]
      ? { text: EMOJI_PRIORITY[m[3]], title: m[0], cls: "stw-chip-priority" }
      : {
          text: `${EMOJI_FIELD[m[1]]} ${shortDate(m[2])}`,
          title: m[0],
          cls: `stw-chip-${EMOJI_FIELD[m[1]]}`,
        };
    out.push({ start: from + m.index, end: from + m.index + m[0].length, spec });
  }
}

/**
 * Is this line one we own? Only task lines get chips.
 *
 * A `[due:: …]` in a paragraph of prose is someone's Dataview query or a note
 * about the syntax, and replacing it there would be the plugin editing text it
 * was never given. Matches the parser's checkbox pattern, any marker char.
 */
const TASK_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[.\]\s/;

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const sel = view.state.selection;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      pos = line.to + 1;
      if (!TASK_LINE_RE.test(line.text)) continue;

      // Cursor (or any part of a selection) on this line → show the source.
      // Per-line rather than per-token: editing one field usually means
      // checking the others, and chips flickering in and out mid-line as the
      // caret moves is worse than a line of plain text.
      const touched = sel.ranges.some((r) => r.from <= line.to && r.to >= line.from);
      if (touched) continue;

      const ranges: Array<{ start: number; end: number; spec: ChipSpec }> = [];
      chipsForLine(line.text, line.from, ranges);
      ranges.sort((a, b) => a.start - b.start);
      for (const r of ranges) {
        builder.add(r.start, r.end, Decoration.replace({ widget: new ChipWidget(r.spec) }));
      }
    }
  }

  return builder.finish();
}

/**
 * The editor extension. Registered from `main.ts` and gated on a setting,
 * because this draws over text the user typed and that should be refusable.
 */
export function metadataChipsExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate): void {
        // Selection is in the list because the cursor entering a line is what
        // reveals it — without it the chips would only update as you type.
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}
