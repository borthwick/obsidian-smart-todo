// Natural-language capture: turn "Buy the milk tomorrow" into a clean title
// plus a due date, so the add box reads like the Onda reference instead of
// storing the raw sentence verbatim.
//
// Two engines:
//   1. The vault's nldates plugin, if installed — richer parsing, shared with
//      the rest of the user's setup.
//   2. A self-contained fallback, so the plugin still works standalone when
//      published for people who don't have nldates.

import type { App } from "obsidian";
import { addDays, formatDate, parseDate, startOfToday } from "./parser";

export interface NlResult {
  /** Title with the matched date phrase removed. */
  title: string;
  /** Resolved due date, or null if no phrase matched. */
  due: Date | null;
  /** The raw phrase that produced the date, for feedback. */
  matched: string | null;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const WEEKDAY_ALIASES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  weds: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6,
};
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Next calendar occurrence of a weekday. `forceNext` skips today even if it matches. */
function nextWeekday(from: Date, target: number, forceNext: boolean): Date {
  let delta = (target - from.getDay() + 7) % 7;
  // "next sunday" when today is Sunday means a week out; a bare "sunday" today
  // resolves to today.
  if (delta === 0 && forceNext) delta = 7;
  return addDays(from, delta);
}

/**
 * Pull a date out of free text. Phrases are matched case-insensitively and are
 * typically trailing ("... tomorrow"), but leading connectors ("on", "by",
 * "due") are tolerated. Returns the date and the title with the phrase removed.
 */
export function parseNaturalDate(input: string): NlResult {
  const raw = input.trim();
  const today = startOfToday();

  // Ordered so more specific patterns win before looser weekday matches.
  // Each returns [date, matchedText].
  const patterns: Array<{ re: RegExp; resolve: (m: RegExpMatchArray) => Date | null }> = [
    // today / tonight
    {
      re: /\b(today|tonight)\b/i,
      resolve: () => today,
    },
    // tomorrow / tmrw
    {
      re: /\b(tomorrow|tmrw|tmr)\b/i,
      resolve: () => addDays(today, 1),
    },
    // yesterday (rare for a todo, but keep the title clean if used)
    {
      re: /\byesterday\b/i,
      resolve: () => addDays(today, -1),
    },
    // in N days / weeks
    {
      re: /\bin\s+(\d{1,3})\s+(day|days|week|weeks)\b/i,
      resolve: (m) => {
        const n = Number(m[1]);
        const unit = m[2].toLowerCase();
        return addDays(today, unit.startsWith("week") ? n * 7 : n);
      },
    },
    // next week
    {
      re: /\bnext\s+week\b/i,
      resolve: () => addDays(today, 7),
    },
    // next <weekday> / this <weekday> / on <weekday> / bare <weekday>
    {
      re: /\b(next|this|on|by)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)\b/i,
      resolve: (m) => {
        const qualifier = (m[1] || "").toLowerCase();
        const word = m[2].toLowerCase();
        let idx = WEEKDAYS.indexOf(word);
        if (idx === -1) idx = WEEKDAY_ALIASES[word] ?? -1;
        if (idx === -1) return null;
        return nextWeekday(today, idx, qualifier === "next");
      },
    },
    // on <month> <day> / <month> <day>
    {
      re: /\b(?:on|by|due)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
      resolve: (m) => {
        const mon = m[1].toLowerCase();
        let mi = MONTHS.indexOf(mon);
        if (mi === -1) mi = MONTHS.findIndex((x) => x.startsWith(mon));
        if (mi === -1) return null;
        const day = Number(m[2]);
        let year = today.getFullYear();
        let candidate = new Date(year, mi, day);
        // A bare month/day in the past rolls to next year.
        if (candidate.getTime() < today.getTime()) {
          candidate = new Date(year + 1, mi, day);
        }
        if (candidate.getMonth() !== mi || candidate.getDate() !== day) return null;
        return candidate;
      },
    },
    // ISO date embedded in prose
    {
      re: /\b(\d{4}-\d{2}-\d{2})\b/,
      resolve: (m) => parseDate(m[1]),
    },
  ];

  for (const { re, resolve } of patterns) {
    const m = raw.match(re);
    if (!m) continue;
    const due = resolve(m);
    if (!due) continue;
    const title = stripPhrase(raw, m[0]);
    return { title, due, matched: m[0].trim() };
  }

  return { title: raw, due: null, matched: null };
}

/** Remove the matched phrase and tidy leftover connectors/whitespace. */
function stripPhrase(text: string, phrase: string): string {
  let out = text.replace(phrase, " ");
  // Drop dangling connective words left behind ("... due", "... by").
  out = out.replace(/\s+(on|by|due|at)\s*$/i, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  // Never return an empty title — fall back to the original sentence.
  return out.length > 0 ? out : text.trim();
}

/**
 * Prefer the vault's nldates plugin when present (keeps parsing consistent with
 * the user's other tools), else use the built-in parser. nldates exposes
 * `parseDate(text) -> { moment, formattedString }` on its instance.
 */
export function parseCapture(app: App, input: string): NlResult {
  const nld = (app as any).plugins?.plugins?.["nldates-obsidian"];
  if (nld && typeof nld.parseDate === "function") {
    try {
      const built = parseNaturalDate(input);
      // Only trust nldates if our own matcher also found a phrase to strip;
      // otherwise we'd set a date but leave the phrase in the title.
      if (built.due && built.matched) {
        const parsed = nld.parseDate(built.matched);
        if (parsed?.moment?.isValid?.()) {
          const d = parsed.moment.toDate();
          return {
            title: built.title,
            due: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
            matched: built.matched,
          };
        }
      }
    } catch (e) {
      // Fall through to the built-in parser on any nldates hiccup.
    }
  }
  return parseNaturalDate(input);
}

/** Compose the task body: clean title + `📅 YYYY-MM-DD` when a date resolved. */
export function buildCaptureBody(app: App, input: string): string {
  const { title, due } = parseCapture(app, input);
  if (!due) return input.trim();
  return `${title} 📅 ${formatDate(due)}`;
}
