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
import { Effort } from "./types";

export interface NlResult {
  /** Title with every matched phrase removed. */
  title: string;
  /** Resolved due date, or null if no phrase matched. */
  due: Date | null;
  /** Resolved defer/available date, or null. */
  defer: Date | null;
  /** Parsed effort, or null. */
  effort: Effort | null;
  /** Parsed project, or null. */
  project: string | null;
  /** Parsed assignee, or null. */
  assigned: string | null;
  /** The raw due phrase that produced the date, for feedback. */
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

interface DateHit {
  date: Date;
  phrase: string;
}

/**
 * Find the first date phrase in `text` and resolve it. Phrases are matched
 * case-insensitively, typically trailing ("... tomorrow"), with leading
 * connectors ("on", "by", "due", "starting", "available") tolerated. Returns
 * the resolved date plus the exact matched substring so the caller can strip it.
 */
function findDatePhrase(text: string): DateHit | null {
  const today = startOfToday();

  // Ordered so more specific patterns win before looser weekday matches.
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
    // next/this/on/by/starting/available/from <weekday> / bare <weekday>
    {
      re: /\b(next|this|on|by|starting|available|from)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)\b/i,
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
    const m = text.match(re);
    if (!m) continue;
    const date = resolve(m);
    if (!date) continue;
    return { date, phrase: m[0] };
  }
  return null;
}

/** Remove a matched phrase and tidy leftover connectors/whitespace. */
function stripPhrase(text: string, phrase: string): string {
  let out = text.replace(phrase, " ");
  // Drop dangling connective words left behind ("... due", "... by").
  out = out.replace(/\s+(on|by|due|at|for|starting|available|from)\s*$/i, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

// "deep" first in the alternation: it's the only two-word form, and a regex
// alternation is first-match-wins, so "deep work" must be offered before the
// bare words that could match inside it.
const EFFORT_RE =
  /\b(deep work|deep|heavy|hard|big|moderate|medium|light|easy|quick|small)\b/i;
const EFFORT_MAP: Record<string, Effort> = {
  "deep work": "deep",
  deep: "deep",
  heavy: "heavy",
  hard: "heavy",
  big: "heavy",
  moderate: "moderate",
  medium: "moderate",
  light: "light",
  easy: "light",
  quick: "light",
  small: "light",
};

/**
 * Full capture parse: pull effort, project, assignee, defer, and due out of one
 * sentence, stripping each matched phrase so the title is left clean.
 *
 * Order matters — tagged fields (#project, @assignee, project: X) are removed
 * first so their words can't be mistaken for date/effort tokens, then defer
 * ("starting monday"), then due.
 */
export function parseNaturalTask(input: string): NlResult {
  let working = input.trim();
  let effort: Effort | null = null;
  let project: string | null = null;
  let assigned: string | null = null;
  let defer: Date | null = null;

  // --- project: #Onda  or  project: Onda / project Onda ---
  const projTag = working.match(/#([A-Za-z0-9][\w-]*)/);
  const projKey = working.match(/\bproject[:\s]+([A-Za-z0-9][\w -]*?)(?=\s*(?:,|;|$|#|@|\bfor\b|\bdue\b|\bby\b))/i);
  if (projTag) {
    project = projTag[1];
    working = stripPhrase(working, projTag[0]);
  } else if (projKey) {
    project = projKey[1].trim();
    working = stripPhrase(working, projKey[0]);
  }

  // --- assignee: @selena  or  "for Selena" (capitalized → a name, not a noun) ---
  const asgTag = working.match(/@([A-Za-z0-9][\w-]*)/);
  const asgFor = working.match(/\bfor\s+([A-Z][a-z]+)\b/);
  if (asgTag) {
    assigned = asgTag[1];
    working = stripPhrase(working, asgTag[0]);
  } else if (asgFor) {
    assigned = asgFor[1];
    working = stripPhrase(working, asgFor[0]);
  }

  // --- effort word ---
  const eff = working.match(EFFORT_RE);
  if (eff) {
    effort = EFFORT_MAP[eff[1].toLowerCase()] ?? null;
    if (effort) working = stripPhrase(working, eff[0]);
  }

  // --- defer: an explicit "starting/available/from <date>" phrase ---
  const deferLead = working.match(/\b(starting|available|from|defer(?:red)?(?:\s+to)?)\s+(.+)$/i);
  if (deferLead) {
    const hit = findDatePhrase(deferLead[2]);
    if (hit) {
      defer = hit.date;
      // Strip the connector + the date phrase together.
      working = stripPhrase(working, `${deferLead[1]} ${hit.phrase}`);
    }
  }

  // --- due: the remaining date phrase ---
  const dueHit = findDatePhrase(working);
  let due: Date | null = null;
  let matched: string | null = null;
  if (dueHit) {
    due = dueHit.date;
    matched = dueHit.phrase.trim();
    working = stripPhrase(working, dueHit.phrase);
  }

  const title = working.length > 0 ? working : input.trim();
  return { title, due, defer, effort, project, assigned, matched };
}

/** Backwards-compatible date-only parse (used by the capture body builder). */
export function parseNaturalDate(input: string): NlResult {
  return parseNaturalTask(input);
}

/**
 * Prefer the vault's nldates plugin when present (keeps parsing consistent with
 * the user's other tools), else use the built-in parser. nldates exposes
 * `parseDate(text) -> { moment, formattedString }` on its instance.
 */
export function parseCapture(app: App, input: string): NlResult {
  const built = parseNaturalTask(input);

  // Let nldates refine the *due* date only (it parses phrasing our fallback may
  // miss), without disturbing the other fields we already stripped.
  const nld = (app as any).plugins?.plugins?.["nldates-obsidian"];
  if (built.due && built.matched && nld && typeof nld.parseDate === "function") {
    try {
      const parsed = nld.parseDate(built.matched);
      if (parsed?.moment?.isValid?.()) {
        const d = parsed.moment.toDate();
        built.due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
    } catch (e) {
      // Keep the fallback date on any nldates hiccup.
    }
  }
  return built;
}

/**
 * Compose the task body from a capture string: clean title plus the inline
 * encoding for whatever fields were parsed — `📅 due`, `⏳ defer`,
 * `[effort:: x]`, `[project:: x]`, `[assigned:: x]`. Order matches the design
 * doc so Tasks/Dataview read it cleanly.
 */
export function buildCaptureBody(app: App, input: string): string {
  const { title, due, defer, effort, project, assigned } = parseCapture(app, input);
  let body = title;
  if (due) body += ` 📅 ${formatDate(due)}`;
  if (defer) body += ` ⏳ ${formatDate(defer)}`;
  if (effort) body += ` [effort:: ${effort}]`;
  if (project) body += ` [project:: ${project}]`;
  if (assigned) body += ` [assigned:: ${assigned}]`;
  return body.trim() || input.trim();
}
