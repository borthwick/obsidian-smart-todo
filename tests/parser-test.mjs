// Parser proof harness.
//
// Bundles the REAL src/parser.ts + src/filters.ts + src/writer.ts with esbuild
// and exercises them against a fixture file in plain node. parser.ts only
// `import type`s from obsidian, so nothing Obsidian-specific survives
// compilation and no host is needed. The writer's `obsidian` value imports are
// stubbed so the pure line-building helpers can be tested too.

import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
// The fixture lives in the repo, not /tmp — an earlier version pointed at a
// scratch path that a reboot quietly deleted, which turns "tests pass" into
// "tests can't run" without anyone noticing.
const FIXTURE = process.argv[2] || join(here, "fixtures", "sample-tasks.md");

const outdir = mkdtempSync(join(tmpdir(), "smart-todo-test-"));
const outfile = join(outdir, "bundle.cjs");

// Minimal stand-in for the few `obsidian` runtime values writer.ts touches.
const obsidianStub = join(outdir, "obsidian-stub.cjs");
writeFileSync(
  obsidianStub,
  `class Notice { constructor(m) { this.message = m; } }
   class TFile {}
   // The migration preview lives in categorize.ts next to its planner; the
   // planner is pure, so a hollow Modal is enough to let the module load.
   class Modal { constructor(app) { this.app = app; } }
   // The inline / menu subclasses EditorSuggest; only its pure line-rewriting
   // helpers are under test, so a hollow base class is enough to let it load.
   class EditorSuggest { constructor(app) { this.app = app; } }
   const setIcon = () => {};
   const addIcon = () => {};
   module.exports = { Notice, TFile, Modal, EditorSuggest, setIcon, addIcon };\n`
);

await esbuild.build({
  stdin: {
    contents: `
      export * from "./src/parser";
      export * as filters from "./src/filters";
      export * as writer from "./src/writer";
      export * as scope from "./src/scope";
      export * as types from "./src/types";
      export * as categorize from "./src/categorize";
      export * as suggest from "./src/task-suggest";
    `,
    resolveDir: repo,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2020",
  outfile,
  logLevel: "warning",
  alias: { obsidian: obsidianStub },
});

const require = createRequire(import.meta.url);
const mod = require(outfile);
const { parseTasksFromContent, formatDate } = mod;
const { bucketFor } = mod.filters;
const { buildPushedLine, buildToggledLine, buildAppendedContent } = mod.writer;
const { parseScope, isInScope, filterTasksToScope, primaryManagedFile } = mod.scope;

const content = readFileSync(FIXTURE, "utf8");
const tasks = parseTasksFromContent(content, "test/sample-tasks.md");

const d = (x) => (x ? formatDate(x) : "—");
let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(actual)}${
      ok ? "" : ` (expected ${JSON.stringify(expected)})`
    }`
  );
};

console.log(`\nFixture: ${FIXTURE}`);
console.log(`Parsed ${tasks.length} task lines.\n`);
console.log("=== DECOMPOSITION ===");
for (const t of tasks) {
  console.log(`\nline ${String(t.lineNumber + 1).padStart(3)} | raw: ${t.rawText.trim()}`);
  console.log(
    `         | title=${JSON.stringify(t.title)}\n` +
      `         | status=${t.status} due=${d(t.due)} defer=${d(t.defer)} done=${d(t.doneDate)}\n` +
      `         | effort=${t.effort ?? "null"} pushes=${t.pushes} project=${
        t.project ?? "null"
      } assigned=${t.assigned ?? "null"}`
  );
}

console.log("\n=== ASSERTIONS ===");

// 1. The canonical example from the spec, fully decomposed.
const marta = tasks.find((t) => t.title.startsWith("Send Marta"));
console.log("\n[canonical task — all fields]");
check("title", marta.title, "Send Marta async screens");
check("status", marta.status, "open");
check("due", d(marta.due), "2026-11-04");
check("defer", d(marta.defer), "2026-11-01");
check("effort", marta.effort, "heavy");
check("pushes", marta.pushes, 1);
check("project", marta.project, "Onda");
check("doneDate", d(marta.doneDate), "—");
check("lineNumber (0-based)", marta.lineNumber, 7);

console.log("\n[non-task lines excluded]");
check("prose line with a stray 📅 not parsed", tasks.some((t) => t.title.startsWith("Prose line")), false);
check(
  "bullet with no checkbox excluded",
  tasks.some((t) => t.title.includes("bullet with no checkbox")),
  false
);
check(
  "empty brackets '- []' excluded",
  tasks.some((t) => t.title.includes("empty brackets")),
  false
);
check("total task count", tasks.length, 9);

console.log("\n[bullet + checkbox variants]");
check("nested '- [ ]' parsed", !!tasks.find((t) => t.title.startsWith("Nested:")), true);
check("'* [ ]' parsed", !!tasks.find((t) => t.title.startsWith("Draft the Camp")), true);
check("'1. [ ]' parsed", !!tasks.find((t) => t.title.startsWith("Ordered-list")), true);
check(
  "'[X]' counts as done",
  tasks.find((t) => t.title.startsWith("Capital-X")).status,
  "done"
);

console.log("\n[value normalization]");
check("effort 'Light' → light", tasks.find((t) => t.title.startsWith("Review the Q4")).effort, "light");
check("effort 'HEAVY' → heavy", tasks.find((t) => t.title.startsWith("Capital-X")).effort, "heavy");
const bad = tasks.find((t) => t.title.startsWith("Bad date"));
check("impossible date 2026-02-31 → null", bad.due, null);
check("non-numeric pushes → 0", bad.pushes, 0);
check("unknown effort 'epic' → null", bad.effort, null);
check("absent pushes field → 0", tasks.find((t) => t.title.startsWith("Ordered-list")).pushes, 0);

console.log("\n[title cleanliness]");
check(
  "wikilinks/bold survive, tokens stripped",
  tasks.find((t) => t.project === "Findings").title,
  "Task with a [[Wikilink]] and a **bold** bit"
);
check(
  "done task title has no ✅ token",
  tasks.find((t) => t.title.startsWith("Book the")).title,
  "Book the Demo Day venue"
);
check(
  "done date captured",
  d(tasks.find((t) => t.title.startsWith("Book the")).doneDate),
  "2026-11-09"
);

console.log("\n[defer / resting behaviour — today pinned to 2026-11-14]");
const TODAY = new Date(2026, 10, 14);
const today = bucketFor(tasks, "today", TODAY);
const week = bucketFor(tasks, "week", TODAY);
const backlog = bucketFor(tasks, "backlog", TODAY);
const completed = bucketFor(tasks, "completed", TODAY);
const overdue = bucketFor(tasks, "overdue", TODAY);
console.log(`  Today:     ${today.tasks.map((t) => t.title).join(" | ") || "(none)"}`);
console.log(`  This Week: ${week.tasks.map((t) => t.title).join(" | ") || "(none)"}`);
console.log(`  Overdue:   ${overdue.tasks.map((t) => t.title).join(" | ") || "(none)"}`);
console.log(`  Backlog:   ${backlog.tasks.map((t) => t.title).join(" | ") || "(none)"}`);
console.log(`  Completed: ${completed.tasks.map((t) => t.title).join(" | ") || "(none)"}`);
console.log(`  restingCount = ${today.restingCount}`);
check(
  "future defer (2027-01-15) hidden from Today",
  today.tasks.some((t) => t.title.startsWith("Draft the Camp")),
  false
);
check(
  "future-deferred task sits in Backlog",
  backlog.tasks.some((t) => t.title.startsWith("Draft the Camp")),
  true
);
check("restingCount counts it", today.restingCount, 1);
check("completed tab holds only the done task", completed.tasks.length, 2);

console.log("\n[Today sort order: overdue → due-today, heavy → light, pushes desc]");
console.log(`  ${today.tasks.map((t) => `${t.title} (${t.effort ?? "-"}, ↻${t.pushes})`).join("\n  ")}`);
check("longest-overdue first", today.tasks[0].title, "Send Marta async screens");
check("due-today sorts last in Today", today.tasks[today.tasks.length - 1].due.getDate(), 14);

console.log("\n[write-back line builders]");
// Push is anchored to the real today, not the pinned TODAY — it writes dates
// relative to the clock, so the expectations are computed the same way.
const { startOfToday, addDays } = mod.writer;
const { isResting, isOverdue } = mod.filters;
const REAL_TODAY = startOfToday();
const inDays = (n) => formatDate(addDays(REAL_TODAY, n));

const pushed = buildPushedLine(marta, 1);
console.log(`  pushed: ${pushed.trim()}`);
// marta is overdue (📅 2026-11-04). The old behaviour added a day to that
// stale date, which left the task overdue, urgent, and still in Do First —
// a push that visibly did nothing. It has to land tomorrow instead.
check("overdue task pushes to tomorrow, not stale-date + 1", pushed.includes(`[due:: ${inDays(1)}]`), true);
check("pushes incremented 1→2", /\[pushes:: 2\]/.test(pushed), true);
check("defer follows the due date", pushed.includes(`[defer:: ${inDays(1)}]`), true);
check("stale defer is replaced, not kept", /⏳ 2026-11-01/.test(pushed), false);
// 0.11: the line came in with emoji dates and leaves with words. Converting on
// touch is the whole migration plan — no sweep over the vault, just the lines
// being worked on cleaning themselves up. Leaving both notations behind would
// be the actual bug: two dates, one line, parser left to arbitrate.
check("the emoji due date is retired, not duplicated", /📅/.test(pushed), false);
check("and so is the emoji defer", /⏳/.test(pushed), false);

// The point of the defer: a pushed task leaves the urgent axis, so it drops
// out of Do First and into Schedule, and returns on its own.
const pushedTask = parseTasksFromContent(pushed, "Tasks.md")[0];
check("pushed task is resting", isResting(pushedTask, REAL_TODAY), true);
check("pushed task is no longer urgent", mod.filters.isUrgent(pushedTask, REAL_TODAY), false);
check("pushed task is no longer overdue", isOverdue(pushedTask, REAL_TODAY), false);
// John's actual case: "Botwick co-investor survey — send out", flagged
// important and 26 days overdue, pushed twice and still sitting in DO FIRST.
const survey = parseTasksFromContent(
  `- [ ] Botwick co-investor survey — send out 📅 2026-10-27 [effort:: moderate] [project:: Betaworks] [important:: true] [pushes:: 2]`,
  "Tasks.md"
)[0];
check("before the push it's Do First", mod.filters.quadrantOf(survey, REAL_TODAY), "do");
const surveyPushed = parseTasksFromContent(buildPushedLine(survey, 1), "Tasks.md")[0];
check("after the push it's Schedule, not Do First", mod.filters.quadrantOf(surveyPushed, REAL_TODAY), "schedule");
check("and the push counter still advances", surveyPushed.pushes, 3);
// ...but it must not vanish from the week. "Push to tomorrow" is not "delete".
check("still in This week", mod.filters.matchesHorizon(pushedTask, "week", REAL_TODAY), true);
check("out of Today, which is the whole point", mod.filters.matchesHorizon(pushedTask, "today", REAL_TODAY), false);

const pushedTwo = buildPushedLine(marta, 2);
check("push by 2 days lands 2 days out", pushedTwo.includes(`[due:: ${inDays(2)}]`), true);
check("a 2-day push isn't urgent either", mod.filters.isUrgent(parseTasksFromContent(pushedTwo, "Tasks.md")[0], REAL_TODAY), false);

// A future due date is a real plan, so push moves it relative to itself.
const future = parseTasksFromContent(
  `- [ ] Future thing 📅 ${inDays(10)} [important:: true]`,
  "Tasks.md"
)[0];
check("future due date pushes from itself", buildPushedLine(future, 1).includes(`[due:: ${inDays(11)}]`), true);

const noPushes = tasks.find((t) => t.title.startsWith("Review the Q4"));
const pushedNew = buildPushedLine(noPushes, 1);
console.log(`  pushed (no due, no defer, no pushes field): ${pushedNew.trim()}`);
check("pushes field appended as 1", /\[pushes:: 1\]/.test(pushedNew), true);
check("undated task gets a due date", pushedNew.includes(`[due:: ${inDays(1)}]`), true);

// A deferred-but-undated task has no deadline, and a push shouldn't invent one.
const deferOnly = parseTasksFromContent("- [ ] Someday thing ⏳ 2026-01-01", "Tasks.md")[0];
const pushedDeferOnly = buildPushedLine(deferOnly, 1);
check("defer-only task still has no due date", /📅|due::/.test(pushedDeferOnly), false);
check("defer-only task's rest restarts from today", pushedDeferOnly.includes(`[defer:: ${inDays(1)}]`), true);

const doneLine = buildToggledLine(marta, true);
console.log(`  completed: ${doneLine.trim()}`);
check("checkbox flipped to [x]", /^- \[x\]/.test(doneLine.trim()), true);
check("done date stamped with today", doneLine.includes(`[done:: ${formatDate(new Date())}]`), true);
check("in words, not ✅", /✅/.test(doneLine), false);

const undone = buildToggledLine(
  tasks.find((t) => t.title.startsWith("Book the")),
  false
);
console.log(`  un-completed: ${undone.trim()}`);
check("checkbox flipped to [ ]", /^- \[ \]/.test(undone.trim()), true);
check("✅ token removed", /✅/.test(undone), false);

// --- Phase 1.5: managed scope -------------------------------------------
//
// The vault holds ~3,000 legacy open checkboxes that are NOT managed tasks.
// Scope filtering is what keeps them out of the view, so prove it: parse the
// same fixture as two different files and confirm only the managed one's
// tasks survive.

console.log("\n=== SCOPE FILTERING ===");

const managed = parseTasksFromContent(content, "Tasks.md");
const unmanaged = parseTasksFromContent(content, "2. Day Planners/2026-11-10.md");
const bothFiles = [...managed, ...unmanaged];
console.log(
  `  Two files parsed: Tasks.md (${managed.length} tasks) + ` +
    `2. Day Planners/2026-11-10.md (${unmanaged.length} tasks) = ${bothFiles.length} total`
);

console.log("\n[single-file scope]");
const fileScope = parseScope("Tasks.md");
const inFileScope = filterTasksToScope(bothFiles, fileScope);
console.log(
  `  scope "Tasks.md" → ${inFileScope.length} tasks from ${[
    ...new Set(inFileScope.map((t) => t.filePath)),
  ].join(", ")}`
);
check("only the managed file's tasks returned", inFileScope.length, managed.length);
check(
  "every surviving task is from Tasks.md",
  inFileScope.every((t) => t.filePath === "Tasks.md"),
  true
);
check(
  "no Day Planner tasks leaked through",
  inFileScope.some((t) => t.filePath.startsWith("2. Day Planners/")),
  false
);
check("unmanaged file excluded", isInScope("2. Day Planners/2026-11-10.md", fileScope), false);
check("usedFallback false when set explicitly", fileScope.usedFallback, false);

console.log("\n[folder scope — recursive]");
const folderScope = parseScope("2. Day Planners");
check("entry without .md parsed as folder", folderScope.entries[0].kind, "folder");
check("direct child matches", isInScope("2. Day Planners/2026-11-10.md", folderScope), true);
check("nested child matches", isInScope("2. Day Planners/2026/Q4/note.md", folderScope), true);
check("sibling file does NOT match", isInScope("Tasks.md", folderScope), false);
check(
  "prefix-only folder name does NOT match",
  isInScope("2. Day Planners Archive/old.md", folderScope),
  false
);
check("the folder note itself does NOT match", isInScope("2. Day Planners.md", folderScope), false);
check(
  "folder scope returns only the planner tasks",
  filterTasksToScope(bothFiles, folderScope).every((t) =>
    t.filePath.startsWith("2. Day Planners/")
  ),
  true
);

console.log("\n[mixed + multi-entry scope]");
const mixed = parseScope("Tasks.md, 2. Day Planners");
check("two entries parsed", mixed.entries.length, 2);
check("both files in scope → all tasks", filterTasksToScope(bothFiles, mixed).length, bothFiles.length);

console.log("\n[input normalization]");
check("leading/trailing slashes stripped", parseScope("/Tasks.md/").entries[0].path, "Tasks.md");
check("whitespace + empty entries dropped", parseScope("  Tasks.md ,, ").entries.length, 1);
check("newline-separated entries accepted", parseScope("Tasks.md\nProjects").entries.length, 2);
check("duplicates collapsed", parseScope("Tasks.md, tasks.md").entries.length, 1);
check("case-insensitive match", isInScope("tasks.md", parseScope("Tasks.md")), true);
check("quoted path unquoted", parseScope('"Tasks.md"').entries[0].path, "Tasks.md");

console.log("\n[blank scope falls back — never opens to the whole vault]");
const blank = parseScope("");
check("fallback flagged", blank.usedFallback, true);
check("fallback is the default file", blank.entries[0].path, "Tasks.md");
check("fallback still excludes other files", isInScope("Some/Other.md", blank), false);
check("undefined setting handled", parseScope(undefined).entries[0].path, "Tasks.md");

console.log("\n[primary managed file — the add-task target]");
check("first file entry wins", primaryManagedFile(parseScope("Tasks.md, Projects")), "Tasks.md");
check(
  "file entry wins even when listed second",
  primaryManagedFile(parseScope("Projects, Inbox.md")),
  "Inbox.md"
);
check(
  "folder-only scope anchors a Tasks.md inside it",
  primaryManagedFile(parseScope("Projects/Active")),
  "Projects/Active/Tasks.md"
);

console.log("\n=== TASK CAPTURE ===");
const stub = "# Tasks\n\n";
const once = buildAppendedContent(stub, "Call the Synology support line");
console.log(`  append to stub: ${JSON.stringify(once)}`);
check("task appended as an open checkbox", /\n- \[ \] Call the Synology support line\n$/.test(once), true);
check("existing header preserved", once.startsWith("# Tasks\n"), true);
check("one blank line kept after the header", once, "# Tasks\n\n- [ ] Call the Synology support line\n");
check("no runaway blank lines", /\n\n\n/.test(once), false);
check(
  "many trailing blanks collapse to one",
  buildAppendedContent("a\n\n\n\n\n", "x"),
  "a\n\n- [ ] x\n"
);

const twice = buildAppendedContent(once, "Second task");
console.log(`  append again:   ${JSON.stringify(twice)}`);
check("second task stacks directly beneath", /- \[ \] Call the Synology support line\n- \[ \] Second task\n$/.test(twice), true);
check("title whitespace trimmed", buildAppendedContent("", "  padded  "), "- [ ] padded\n");
check("empty file handled", buildAppendedContent("", "x"), "- [ ] x\n");
check(
  "appended line round-trips through the parser",
  parseTasksFromContent(twice, "Tasks.md").length,
  2
);

// --- Eisenhower matrix: importance parsing + urgency/quadrant logic -----
//
// Synthetic tasks (not the shared fixture, whose counts are asserted above).
// today pinned to 2026-11-14 so urgency windows are deterministic.

console.log("\n=== EISENHOWER MATRIX ===");

const { isUrgent, isImportant, isUnjudged, quadrantOf, matchesQuadFilter } =
  mod.filters;
const { buildImportantLine } = mod.writer;

const EISEN = `# Eisenhower fixture
- [ ] Fire: due today, important 📅 2026-11-14 [important:: true]
- [ ] Soon fire: due tomorrow, important 📅 2026-11-15 [important:: true]
- [ ] Overdue + important 📅 2026-11-10 [important:: true]
- [ ] Important but far off 📅 2026-12-20 [important:: true]
- [ ] Undated but important [important:: true]
- [ ] Urgent not important: due today 📅 2026-11-14 [important:: false]
- [ ] Neither: far off, not important 📅 2026-12-20 [important:: false]
- [ ] Unjudged, due today 📅 2026-11-14
- [ ] Unjudged, undated
- [ ] Deferred past due is not urgent 📅 2026-11-14 ⏳ 2027-01-01 [important:: true]
`;
const et = parseTasksFromContent(EISEN, "Eisenhower.md");
const byTitle = (p) => et.find((t) => t.title.startsWith(p));

console.log("\n[important field parsing]");
check("'true' → important=true", byTitle("Fire").important, true);
check("'false' → important=false", byTitle("Urgent not important").important, false);
check("absent → important=null (unjudged)", byTitle("Unjudged, due today").important, null);

console.log("\n[urgency derived from the due date, 2-day window]");
check("due today is urgent", isUrgent(byTitle("Fire"), TODAY), true);
check("due tomorrow is urgent", isUrgent(byTitle("Soon fire"), TODAY), true);
check("overdue is urgent", isUrgent(byTitle("Overdue"), TODAY), true);
check("due in >2 days is not urgent", isUrgent(byTitle("Important but far off"), TODAY), false);
check("undated is never urgent", isUrgent(byTitle("Undated but important"), TODAY), false);
check("future-deferred is NOT urgent even if due soon", isUrgent(byTitle("Deferred past due"), TODAY), false);

console.log("\n[quadrant placement]");
check("urgent+important → do", quadrantOf(byTitle("Fire"), TODAY), "do");
check("important, not urgent → schedule", quadrantOf(byTitle("Important but far off"), TODAY), "schedule");
check("urgent, not important → delegate", quadrantOf(byTitle("Urgent not important"), TODAY), "delegate");
check("neither → drop", quadrantOf(byTitle("Neither"), TODAY), "drop");
check("unjudged treated as not-important for placement", quadrantOf(byTitle("Unjudged, due today"), TODAY), "delegate");

console.log("\n[filter buttons]");
const pass = (id) => et.filter((t) => matchesQuadFilter(t, id, TODAY)).map((t) => t.title);
check("'all' passes everything", et.every((t) => matchesQuadFilter(t, "all", TODAY)), true);
// 6 important tasks total (Fire, Soon fire, Overdue, Far-off, Undated,
// Deferred-past-due). 3 of them are urgent (Fire, Soon fire, Overdue) → "do";
// the other 3 are not urgent (Far-off, Undated, Deferred) → "schedule".
check("'do' = urgent & important (3)", pass("do").length, 3);
check("'schedule' = important, not urgent (3)", pass("schedule").length, 3);
check("'delegate' = urgent, not important (2)", pass("delegate").length, 2);
check("'drop' excludes unjudged (1)", pass("drop").length, 1);
check("'important' = any importance=true (6)", pass("important").length, 6);
check("'urgent' = any urgency (5)", pass("urgent").length, 5);
check("'unjudged' = importance unset (2)", pass("unjudged").length, 2);

console.log("\n[bucketFor applies the quad filter]");
const bWeek = bucketFor(et, "week", TODAY, "do");
console.log(`  This Week + 'do': ${bWeek.tasks.map((t) => t.title).join(" | ") || "(none)"}`);
check("This Week + 'do' keeps only urgent+important in-week", bWeek.tasks.every((t) => quadrantOf(t, TODAY) === "do"), true);

console.log("\n[importance write-back]");
const impLine = buildImportantLine(byTitle("Unjudged, due today"), true);
console.log(`  set important: ${impLine.trim()}`);
check("writes [important:: true]", /\[important:: true\]/.test(impLine), true);
const clearLine = buildImportantLine(byTitle("Fire"), null);
console.log(`  clear important: ${clearLine.trim()}`);
check("clearing removes the field", /important::/.test(clearLine), false);
const flipLine = buildImportantLine(byTitle("Fire"), false);
check("flips true→false in place", /\[important:: false\]/.test(flipLine), true);
check("no duplicate field on flip", (flipLine.match(/important::/g) || []).length, 1);


// --- 0.7.0: categories, title rewriting, multi-field patching -----------
//
// The patch builder is the riskiest thing in the plugin: it's the one code
// path that rewrites a whole line rather than one token. These assertions
// exist to prove it can't silently eat a field it doesn't model.

console.log("\n=== CATEGORIES ===");

const { asCategory, categoryFor } = mod.types;

console.log("\n[canonical values]");
check("'betaworks' is canonical", asCategory("betaworks"), "betaworks");
check("'Personal' normalizes case", asCategory("Personal"), "personal");
check("'Investing' is NOT canonical", asCategory("Investing"), null);
check("null in → null out", asCategory(null), null);

console.log("\n[legacy folds]");
check("Investing → betaworks", categoryFor("Investing"), "betaworks");
check("Research → betaworks", categoryFor("Research"), "betaworks");
check("Finance → personal (his money, not the fund's)", categoryFor("Finance"), "personal");
check("Family → personal", categoryFor("Family"), "personal");
check("Home → personal", categoryFor("Home"), "personal");
check("Health → health", categoryFor("Health"), "health");
check("unknown value falls back to personal", categoryFor("Gardening"), "personal");
check("blank stays unset", categoryFor("   "), null);
check("no project stays unset", categoryFor(null), null);

console.log("\n[migration plan skips what it shouldn't touch]");
const { planCategoryMigration } = mod.categorize;
const MIG = `# Migration fixture
- [ ] Already canonical [project:: betaworks]
- [ ] Legacy work item [project:: Investing]
- [ ] Legacy life item [project:: Home]
- [ ] No project at all 📅 2026-11-20
`;
const migTasks = parseTasksFromContent(MIG, "Tasks.md");
const plan = planCategoryMigration(migTasks);
console.log(`  plan: ${plan.map((c) => `${c.from}→${c.to}`).join(", ") || "(none)"}`);
check("only non-canonical tagged tasks planned", plan.length, 2);
check("canonical task untouched", plan.some((c) => c.from === "betaworks"), false);
check("untagged task untouched", plan.some((c) => !c.from), false);
check("Investing mapped to betaworks", plan.find((c) => c.from === "Investing").to, "betaworks");

console.log("\n=== TASK EDITOR WRITE-BACK ===");

const { buildRetitledLine, buildPatchedLine } = mod.writer;

// A line carrying every token type, including two the parser does NOT model
// (🔁 recurrence and a hand-written [context:: …]). Those are the canaries.
const RICH = `- [ ] Email Vinneth at Plastic re: FDA 📅 2026-11-20 ⏳ 2026-11-18 🔁 every week [effort:: moderate] [project:: Investing] [important:: true] [pushes:: 2] [context:: phone]`;
const rich = parseTasksFromContent(RICH, "Tasks.md")[0];

console.log("\n[title rewrite preserves every token]");
const retitled = buildRetitledLine(rich, "Email Vinneth re: FDA submission");
console.log(`  ${retitled}`);
check("new title present", retitled.includes("Email Vinneth re: FDA submission"), true);
check("old title gone", retitled.includes("at Plastic"), false);
check("due kept", /📅 2026-11-20/.test(retitled), true);
check("defer kept", /⏳ 2026-11-18/.test(retitled), true);
check("unmodelled 🔁 recurrence rule kept whole", /🔁 every week/.test(retitled), true);
// The `u` flag regression guard: without it, the priority-emoji character
// class matches the lead surrogate of 🔁 and a half-character is lifted out.
check("no lone surrogate left behind", /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(retitled), false);
check("unmodelled [context::] field kept", /\[context:: phone\]/.test(retitled), true);
check("checkbox preserved", retitled.startsWith("- [ ] "), true);
check("round-trips through the parser", parseTasksFromContent(retitled, "Tasks.md").length, 1);
check(
  "re-parsed title is clean",
  parseTasksFromContent(retitled, "Tasks.md")[0].title,
  "Email Vinneth re: FDA submission"
);

console.log("\n[empty title refused rather than writing a blank task]");
let threw = false;
try {
  buildRetitledLine(rich, "   ");
} catch (e) {
  threw = true;
}
check("blank title throws", threw, true);

console.log("\n[patch = diff only; omitted fields survive untouched]");
const patched = buildPatchedLine(rich, { project: "betaworks" });
console.log(`  ${patched}`);
check("project rewritten", /\[project:: betaworks\]/.test(patched), true);
check("no duplicate project field", (patched.match(/project::/g) || []).length, 1);
check("title untouched", patched.includes("Email Vinneth at Plastic re: FDA"), true);
check("effort untouched", /\[effort:: moderate\]/.test(patched), true);
check("important untouched", /\[important:: true\]/.test(patched), true);
check("pushes untouched", /\[pushes:: 2\]/.test(patched), true);
check("due untouched", /📅 2026-11-20/.test(patched), true);

console.log("\n[multi-field patch applied in one line]");
const multi = buildPatchedLine(rich, {
  title: "Email Vinneth re: FDA",
  due: new Date(2026, 10, 25),
  defer: null,
  effort: "light",
  important: false,
  project: "betaworks",
  pushes: 0,
});
console.log(`  ${multi}`);
const reparsed = parseTasksFromContent(multi, "Tasks.md")[0];
check("title set", reparsed.title, "Email Vinneth re: FDA");
check("due moved", d(reparsed.due), "2026-11-25");
check("defer cleared", reparsed.defer, null);
check("effort set to light", reparsed.effort, "light");
check("important flipped to false", reparsed.important, false);
check("category set", reparsed.project, "betaworks");
check("pushes reset to 0 clears the field", /pushes::/.test(multi), false);
check("recurrence survives a seven-field patch", /🔁 every week/.test(multi), true);
check("unmodelled [context::] survives too", /\[context:: phone\]/.test(multi), true);
check("still a valid open task line", reparsed.status, "open");
check("no stray double spaces", /  /.test(multi), false);

console.log("\n[empty patch is a no-op]");
check("no fields → line unchanged", buildPatchedLine(rich, {}), RICH);

console.log("\n[clearing fields]");
const cleared = buildPatchedLine(rich, { due: null, effort: null, important: null, project: null });
console.log(`  ${cleared}`);
// Clearing has to clear both notations, or the field goes and the emoji the
// line arrived with quietly becomes the due date again.
check("due removed", /📅/.test(cleared), false);
check("in both notations", /due::/.test(cleared), false);
check("effort removed", /effort::/.test(cleared), false);
check("important removed", /important::/.test(cleared), false);
check("project removed", /project::/.test(cleared), false);
check("defer survives", /⏳ 2026-11-18/.test(cleared), true);
check("title survives", cleared.includes("Email Vinneth at Plastic re: FDA"), true);

// ======================================================================
// 0.9 — inbox triage: where a kept line lands, and what Drop records.
// ======================================================================

const { insertIndexFor, buildInsertedContent, buildKeptContent, buildDroppedLine, locateTaskLine } =
  mod.writer;
const { samePath, addPathToScope, removePathFromScope, scopeIncludesPath } = mod.scope;

console.log("\n[samePath — the inbox match, hand-typed and case-insensitive]");
check("identical", samePath("a/Task inbox.md", "a/Task inbox.md"), true);
check("case differs", samePath("A/Task Inbox.md", "a/task inbox.md"), true);
check("leading slash normalized", samePath("/a/b.md", "a/b.md"), true);
check("different files", samePath("a/b.md", "a/c.md"), false);
check("blank matches nothing", samePath("", "a/b.md"), false);
check("null matches nothing", samePath(null, "a/b.md"), false);
check("two blanks still don't match", samePath("", ""), false);

console.log("\n[insertIndexFor — a triage heading wins]");
const withHeading = [
  "# Tasks",
  "",
  "## Kept",
  "- [ ] already triaged",
  "",
  "## From OmniFocus",
  "- [ ] imported",
].join("\n");
// Lands after the last line of the Kept section, before the next `##`.
check("inserts at end of the Kept section", insertIndexFor(withHeading.split("\n")), 4);
const keptInto = buildInsertedContent(withHeading, "- [ ] fresh capture");
const keptLines = keptInto.split("\n");
check("new line is inside Kept", keptLines[4], "- [ ] fresh capture");
check("not filed under From OmniFocus", keptLines.indexOf("## From OmniFocus") > 4, true);

console.log("\n[insertIndexFor — no heading, so stay above the fence]");
const withFence = ["# Tasks", "- [ ] one", "", "```dataview", "task", "```"].join("\n");
check("index is above the blank line before the fence", insertIndexFor(withFence.split("\n")), 2);
const fenceInto = buildInsertedContent(withFence, "- [ ] two");
check("line precedes the fence", fenceInto.indexOf("- [ ] two") < fenceInto.indexOf("```"), true);
check("fence survives intact", /```dataview\ntask\n```/.test(fenceInto), true);

console.log("\n[insertIndexFor — nothing to anchor on, so append]");
const plain = ["# Tasks", "- [ ] one"].join("\n");
check("no anchor found", insertIndexFor(plain.split("\n")), -1);
check("appends at the end", buildInsertedContent(plain, "- [ ] two"), "# Tasks\n- [ ] one\n- [ ] two\n");
check("trailing newline, exactly one", /\n$/.test(buildInsertedContent(plain, "- [ ] two")), true);

console.log("\n[buildKeptContent — writes the heading the tracker lacks]");
// The real shape of Task tracker.md: ends in an OmniFocus import section, so
// a plain append would file a kept task under "### Later".
const tracker = ["# Tasks", "", "## From OmniFocus", "", "### Later", "- [ ] someday"].join("\n");
const kept = buildKeptContent(tracker, "- [ ] call the propane place");
console.log(kept.split("\n").map((l) => `    ${l}`).join("\n"));
check("a Kept heading now exists", /^## Kept$/m.test(kept), true);
check("the task sits under it", /## Kept\n\n- \[ \] call the propane place/.test(kept), true);
check("not filed under ### Later", kept.indexOf("## Kept") > kept.indexOf("### Later"), true);
check("the someday task is untouched", /- \[ \] someday/.test(kept), true);
check("blank line before the new heading", /- \[ \] someday\n\n## Kept/.test(kept), true);

const keptTwice = buildKeptContent(kept, "- [ ] second capture");
check("second Keep reuses the heading", (keptTwice.match(/## Kept/g) || []).length, 1);
check(
  "and joins the section",
  /- \[ \] call the propane place\n- \[ \] second capture/.test(keptTwice),
  true
);

const fenced = ["# Tasks", "", "```tasks", "not done", "```"].join("\n");
const keptFenced = buildKeptContent(fenced, "- [ ] x");
check("heading goes above a fence, never inside it", keptFenced.indexOf("## Kept") < keptFenced.indexOf("```"), true);
check("fence intact", /```tasks\nnot done\n```/.test(keptFenced), true);

console.log("\n[locateTaskLine — refuses to guess]");
const one = parseTasksFromContent("- [ ] alpha\n- [ ] beta", "Tasks.md")[1];
check("finds the line by content", locateTaskLine(["- [ ] alpha", "- [ ] beta"], one), 1);
check("finds it after it moved", locateTaskLine(["x", "- [ ] alpha", "- [ ] beta"], one), 2);
let staleThrew = false;
try {
  locateTaskLine(["- [ ] alpha"], one);
} catch (e) {
  staleThrew = true;
}
check("gone from disk → throws", staleThrew, true);
check(
  "recorded line still holds the text → trust it, duplicates or not",
  locateTaskLine(["- [ ] beta", "- [ ] beta"], one),
  1
);
let ambiguousThrew = false;
try {
  // Moved *and* duplicated: nothing left to disambiguate on.
  locateTaskLine(["- [ ] beta", "x", "- [ ] beta"], one);
} catch (e) {
  ambiguousThrew = true;
}
check("moved and duplicated → throws rather than picking one", ambiguousThrew, true);

console.log("\n[Drop — a decision, not a deletion]");
const capture = parseTasksFromContent(
  "- [ ] call the propane place [stream:: 7f3c-aa] [effort:: light]",
  "Task inbox.md"
)[0];
const droppedLine = buildDroppedLine(capture);
console.log(`  ${droppedLine}`);
const droppedTask = parseTasksFromContent(droppedLine, "Task inbox.md")[0];
check("ticked", droppedTask.status, "done");
check("dropped date recorded", d(droppedTask.dropped), formatDate(new Date()));
check("done date recorded too", d(droppedTask.doneDate), formatDate(new Date()));
check("stream id survives — or the bridge re-adds it", /\[stream:: 7f3c-aa\]/.test(droppedLine), true);
check("title survives", droppedTask.title, "call the propane place");
check("one dropped field only", (droppedLine.match(/dropped::/g) || []).length, 1);
check("an ordinary done line has no dropped date", parseTasksFromContent("- [x] x ✅ 2026-11-01", "T.md")[0].dropped, null);

// ======================================================================
// 0.9.1 — tracking a project note: scope edits that keep the user's text.
// ======================================================================

const TRACKER = "3. Evergreen & fleeting Notes/Task tracker.md";
const INBOX = "3. Evergreen & fleeting Notes/Task inbox.md";
const TURKEY = "4. Projects/Turkey Fry Prep — Thanksgiving 2026 🦃.md";
const commaScope = `${TRACKER}, ${INBOX}`;

console.log("\n[addPathToScope — append, never displace the capture target]");
const widened = addPathToScope(commaScope, TURKEY);
check("note added", scopeIncludesPath(widened, TURKEY), true);
check("comma format kept", widened, `${commaScope}, ${TURKEY}`);
check("tracker is still first, so capture still lands there", parseScope(widened).entries[0].path, TRACKER);
check("three entries", parseScope(widened).entries.length, 3);
check("still a file entry, not a folder", parseScope(widened).entries[2].kind, "file");
check("adding twice is a no-op", addPathToScope(widened, TURKEY), widened);
check("case-insensitive, so no near-duplicate", addPathToScope(widened, TURKEY.toUpperCase()), widened);
check("blank scope → just the path", addPathToScope("", TURKEY), TURKEY);
check("blank scope, undefined setting", addPathToScope(undefined, TURKEY), TURKEY);
check("a line-per-entry list stays lines", addPathToScope(`${TRACKER}\n${INBOX}`, TURKEY), `${TRACKER}\n${INBOX}\n${TURKEY}`);
check("empty path is rejected", addPathToScope(commaScope, "   "), commaScope);

console.log("\n[removePathFromScope — stop scanning, touch nothing else]");
check("note gone", scopeIncludesPath(removePathFromScope(widened, TURKEY), TURKEY), false);
check("the others survive verbatim", removePathFromScope(widened, TURKEY), commaScope);
check("case-insensitive removal", removePathFromScope(widened, TURKEY.toUpperCase()), commaScope);
check("removing something absent is a no-op", removePathFromScope(commaScope, "nope.md"), commaScope);
check("lines stay lines", removePathFromScope(`${TRACKER}\n${INBOX}\n${TURKEY}`, TURKEY), `${TRACKER}\n${INBOX}`);
// Emptying the scope must fall back to the default file, never the whole vault.
check("emptied scope falls back rather than opening up", parseScope(removePathFromScope(TURKEY, TURKEY)).usedFallback, true);

console.log("\n[scopeIncludesPath — exact entries only, not folder coverage]");
check("named file", scopeIncludesPath(commaScope, INBOX), true);
check("a file inside a named folder is in scope but not an entry", scopeIncludesPath("4. Projects", TURKEY), false);
check("blank scope includes nothing", scopeIncludesPath("", TRACKER), false);

console.log("\n[tracked project note — tasks parse and stay addressable]");
const turkeyTasks = parseTasksFromContent(
  ["## 🛒 Shopping list", "- [ ] Propane", "- [x] Turkey ✅ 2026-11-21", "- [ ] Peanut oil"].join("\n"),
  TURKEY
);
check("only the real checkboxes", turkeyTasks.length, 3);
check("open ones counted", turkeyTasks.filter((t) => t.status === "open").length, 2);
check("already-ticked stays ticked", turkeyTasks[1].status, "done");
check("unsized, so budget-filtered to Any", turkeyTasks[0].effort, null);
check("file path recorded for the source chip", turkeyTasks[0].filePath, TURKEY);
check("in scope once tracked", mod.scope.isInScope(TURKEY, parseScope(widened)), true);
check("out of scope once untracked", mod.scope.isInScope(TURKEY, parseScope(commaScope)), false);

// ======================================================================
// 0.9.2 — why a tracked project note looked empty, and how prose reads.
// ======================================================================

const { matchesHorizon } = mod.filters;
const { displayTitle } = mod;

console.log("\n[matchesHorizon — Today and This week need a date]");
const undatedOpen = parseTasksFromContent("- [ ] Buy peanut oil", TURKEY)[0];
check("undated is hidden by Today", matchesHorizon(undatedOpen, "today"), false);
check("undated is hidden by This week", matchesHorizon(undatedOpen, "week"), false);
check("undated shows under All — the fix John needs", matchesHorizon(undatedOpen, "all"), true);
check("undated is not Done", matchesHorizon(undatedOpen, "done"), false);
const datedToday = parseTasksFromContent(`- [ ] Call the propane place 📅 ${formatDate(new Date())}`, TURKEY)[0];
check("dated today shows under Today", matchesHorizon(datedToday, "today"), true);
// All ten open tasks on the real turkey note are undated — which is exactly
// how "tracking it, 10 open tasks" produced a panel with nothing new in it.
const turkeyOpen = turkeyTasks.filter((t) => t.status === "open");
check("none of the tracked note's open tasks are dated", turkeyOpen.filter((t) => t.due).length, 0);
check("so Today shows none of them", turkeyOpen.filter((t) => matchesHorizon(t, "today")).length, 0);
check("and All shows all of them", turkeyOpen.filter((t) => matchesHorizon(t, "all")).length, turkeyOpen.length);

console.log("\n[displayTitle — prose notes render as prose, on screen only]");
check("bold unwrapped, not deleted", displayTitle("**Propane — full 20 lb tank** (fill now)"), "Propane — full 20 lb tank (fill now)");
check("italic", displayTitle("Pat the bird *bone-dry*"), "Pat the bird bone-dry");
check("bold-italic", displayTitle("***Never*** water on an oil fire"), "Never water on an oil fire");
check("underscore bold", displayTitle("__Thaw__ the turkey"), "Thaw the turkey");
check("highlight", displayTitle("==Inject== 12–24h ahead"), "Inject 12–24h ahead");
check("code span", displayTitle("run `npm run build`"), "run npm run build");
check("wikilink with alias keeps the alias", displayTitle("Our take on [[Alton Brown's Roast Turkey|Alton Brown]]"), "Our take on Alton Brown");
check("bare wikilink keeps the page name", displayTitle("See [[Turkey Fry Prep]]"), "See Turkey Fry Prep");
check("markdown link keeps the text", displayTitle("See [the docs](https://example.com)"), "See the docs");
check("plain text untouched", displayTitle("Refill the propane tank"), "Refill the propane tank");
check("an asterisk that isn't emphasis survives", displayTitle("2 * 3 tanks"), "2 * 3 tanks");
check("empty stays empty", displayTitle(""), "");
// The stored line must never be rewritten by a display concern — that's how
// you lose text. Display is derived; rawText is authority.
const boldTask = parseTasksFromContent("- [ ] **Propane** [effort:: light]", TURKEY)[0];
check("rawText keeps its markdown", boldTask.rawText, "- [ ] **Propane** [effort:: light]");
check("title keeps its markdown too", boldTask.title, "**Propane**");
check("only the display form is stripped", displayTitle(boldTask.title), "Propane");

console.log("\n[search is scoped to the filters — and has to say so]");
{
  // John, 2026-11-22: "Why are there items in the task list that dont show up
  // in the plugin when I search (ie: gala)". Three gala lines in the tracker,
  // panel on Today, search box reading "gala", body reading "Nothing matches".
  const { selectTasks, matchesSearch } = mod.filters;
  const REAL = mod.writer.startOfToday();
  const gala = parseTasksFromContent(
    [
      "- [x] send final invites to the gala \u{1F4C5} 2026-11-17 [pushes:: 3] \u2705 2026-11-15",
      "- [x] send final invites to NYPR gala \u2705 2026-11-14",
      "- [ ] send final gala invites tomorrow",
      "- [ ] book the car \u{1F4C5} 2026-11-01 [effort:: light]",
    ].join("\n"),
    "Task tracker.md"
  );
  const q = (over = {}) => ({
    horizon: "today",
    budget: "any",
    category: "all",
    search: "gala",
    ...over,
  });

  check("Today + 'gala' selects nothing — exactly what he saw", selectTasks(gala, q(), REAL).length, 0);
  check("while three gala tasks are sitting right there", matchesSearch(gala, "gala").length, 3);
  check("two of them are finished", matchesSearch(gala, "gala").filter((t) => t.status === "done").length, 2);
  check("and the open one has no due date, which is why Today drops it", matchesSearch(gala, "gala").filter((t) => t.status === "open" && !t.due).length, 1);

  const everywhere = selectTasks(gala, q({ searchEverywhere: true }), REAL);
  check("searching everywhere finds all three", everywhere.length, 3);
  check("live work sorts above history", everywhere[0].status, "open");
  check("the open match is the undated line", everywhere[0].title, "send final gala invites tomorrow");
  check("history is newest-completed first", everywhere[1].title, "send final invites to the gala");
  check("and the unrelated task stays out of a search", everywhere.some((t) => t.title.includes("car")), false);

  // Guard rails: the escape hatch must not leak into the unsearched list, or
  // every chip in the panel quietly stops meaning anything.
  const plainToday = selectTasks(gala, q({ search: "" }), REAL);
  const flaggedNoNeedle = selectTasks(gala, q({ search: "", searchEverywhere: true }), REAL);
  check("searchEverywhere with an empty box changes nothing", flaggedNoNeedle.length, plainToday.length);
  check("a genuinely absent term still finds nothing", matchesSearch(gala, "propane").length, 0);
  check("search is case-insensitive", matchesSearch(gala, "GALA").length, 3);
  check("so the empty state can tell the two apart", matchesSearch(gala, "propane").length === 0 && matchesSearch(gala, "gala").length > 0, true);
}

console.log("\n[tracked notes fold under their own heading]");
{
  // John, 2026-11-22: "when pulling in items off a page I think they need to be
  // folded under the a title — ie: 'Frying Turkey items'".
  const { groupBySource, selectTasks } = mod.filters;
  const REAL = mod.writer.startOfToday();
  const HOME = "3. Evergreen & fleeting Notes/Task tracker.md";
  const NOTE = "botwick projects & model chats/Turkey Fry Prep.md";
  const OTHER = "botwick projects & model chats/Camp apps.md";
  const isHome = (p) => p === HOME;

  const mixed = [
    ...parseTasksFromContent("- [ ] Send the LP letter \u{1F4C5} 2026-11-01 [important:: true]\n- [ ] Book the car", HOME),
    ...parseTasksFromContent("- [ ] Refill the propane tank\n- [ ] Thaw the turkey fully\n- [x] Buy peanut oil \u2705 2026-11-21", NOTE),
    ...parseTasksFromContent("- [ ] Score the Camp applications [effort:: heavy]", OTHER),
  ];

  const split = groupBySource(mixed, isHome);
  check("the day's own list keeps only task-file tasks", split.main.length, 2);
  check("one group per tracked note", split.groups.length, 2);
  check("first group is the turkey note", split.groups[0].path, NOTE);
  check("with all three of its lines", split.groups[0].tasks.length, 3);
  check("second group is the other note", split.groups[1].path, OTHER);
  check("no task is lost in the split", split.main.length + split.groups.reduce((n, g) => n + g.tasks.length, 0), mixed.length);
  check("and none is counted twice", new Set([...split.main, ...split.groups.flatMap((g) => g.tasks)]).size, mixed.length);

  // Folding is a display concern only: it must sit *after* selection, so the
  // filters still decide what exists before the grouping decides where it sits.
  const todayOnly = selectTasks(mixed, { horizon: "today", budget: "any", category: "all", search: "" }, REAL);
  const todaySplit = groupBySource(todayOnly, isHome);
  check("Today still hides the undated note tasks", todaySplit.groups.length, 0);
  check("leaving just the dated tracker task", todaySplit.main.length, 1);

  // Group order follows the sorted list, so the most pressing note floats up.
  const noteFirst = groupBySource([mixed[5], mixed[2]], isHome);
  check("group order follows task order", noteFirst.groups[0].path, OTHER);

  check("nothing tracked means no groups at all", groupBySource(parseTasksFromContent("- [ ] Book the car", HOME), isHome).groups.length, 0);
}

// --- 0.10: the weekly page ------------------------------------------------
//
// The week page is a real file in the vault, and it broke three assumptions at
// once: a theme status marker the checkbox regex refused to see, priority
// emoji that were parsed and thrown away, and a heading that states the
// Eisenhower judgment for a whole list. These assertions are that file's
// structure, abridged.

{
  const { parseTasksFromContent, parseTaskLine, cleanHeading } = mod;
  const { groupByHeading, isContainer, groupBySource } = mod.filters;
  const WEEK = "2. Day Planners/Weeks/Week 48 of 2026.md";

  const page = [
    '<mark class="hltr-light-ash">Held this week \u{1FAA1} </mark>',
    "",
    "##### <mark class=\"hltr-light-ash\">Focus this week, what is Important and Urgent</mark>",
    "- [ ] Fund 4 build to 30M.   Fahim next",
    "\t- [ ] Do call with Jim to start to setup with Stepstone",
    "\t- [ ] Kanban update for f4",
    "- [ ] Fund 1 carry re-allocations",
    "###### IMPORTANT",
    "",
    "##### Fund 4.0 Prep, and start raising  \u{1F53C}  ",
    "- [ ] Fund 4  deck review",
    "",
    "- [u] **2025 Taxes** \u{23EB} \u{1F4C5} 2026-04-15",
    "\t- [ ] Email review of Tax docs \u{23F3} 2026-03-27 \u{1F53C}",
    "",
    "##### Reading",
    "- [ ] Skim the Komoroske post \u{23EC}",
    "",
    "##### High Quality Notes created in the past week",
    "```base",
    "- [ ] not a task, this is a Bases query",
    "views: table",
    "```",
  ].join("\n");

  const tasks = parseTasksFromContent(page, WEEK);
  check("every real checkbox is seen, none from the fence", tasks.length, 8);
  check("the fenced line is not a task", tasks.some((t) => /Bases query/.test(t.title)), false);

  // The marker the old regex couldn't see at all.
  const taxes = tasks.find((t) => /2025 Taxes/.test(t.title));
  check("a theme status marker still parses", !!taxes, true);
  check("and counts as open, not done", taxes.status, "open");
  check("keeping its own character", taxes.marker, "u");

  // Priority emoji, which used to be stripped and discarded.
  check("high priority is read off the line", taxes.priority, "high");
  check("and makes the task important", taxes.important, true);
  check("saying so came from the priority", taxes.importantFrom, "priority");
  const komoroske = tasks.find((t) => /Komoroske/.test(t.title));
  check("lowest priority reads as not important", komoroske.important, false);

  // The heading that states the judgment once for a whole list.
  const fund4 = tasks.find((t) => /Fund 4 build/.test(t.title));
  check("the heading survives the <mark> wrapper", fund4.heading, "Focus this week, what is Important and Urgent");
  check("and confers importance", fund4.important, true);
  check("from the heading", fund4.importantFrom, "heading");
  check("a heading elsewhere confers nothing", komoroske.heading, "Reading");

  // Nesting.
  const jim = tasks.find((t) => /with Jim/.test(t.title));
  check("a sub-task points at its parent", jim.parentLine, fund4.lineNumber);
  check("the parent knows how many are open", fund4.openChildren, 2);
  check("and reads as a container", isContainer(fund4), true);
  check("a leaf does not", isContainer(jim), false);
  const emailTax = tasks.find((t) => /Email review/.test(t.title));
  check("an explicit priority beats the parent", emailTax.importantFrom, "priority");

  // Importance flows downhill from a parent that has it, when the child is silent.
  const inherited = parseTasksFromContent(
    "- [ ] Ship it [important:: true]\n  - [ ] Write the release note",
    WEEK
  );
  check("a silent child inherits importance", inherited[1].important, true);
  check("and says where from", inherited[1].importantFrom, "parent");

  // A heading ends the list above it, so the next section's first task is not
  // adopted by the previous section's last parent.
  const across = parseTasksFromContent(
    "## A\n- [ ] Parent\n\t- [ ] Child\n## B\n- [ ] Fresh start",
    WEEK
  );
  check("a heading breaks the ancestry chain", across[2].parentLine ?? null, null);

  // Heading sub-grouping, which is what the panel draws.
  const sections = groupByHeading(tasks);
  check("one section per heading that has tasks", sections.length, 3);
  check("in page order", sections[0].heading, "Focus this week, what is Important and Urgent");
  check("with the right tasks in the first", sections[0].tasks.length, 4);
  check("no task is lost across sections", sections.reduce((n, s) => n + s.tasks.length, 0), tasks.length);

  check("cleanHeading strips marks and trailing hashes", cleanHeading("### <mark class=\"x\">Focus</mark> ###"), "Focus");

  // The Tasks plugin's machine ids are addresses, not words.
  check(
    "a task id is stripped from the title",
    parseTaskLine("- [ ] Email review of Tax docs \u{23F3} 2026-03-27 \u{1F53C} \u{1F194} eb5khv", WEEK, 0).title,
    "Email review of Tax docs"
  );
  check(
    "and so is a blocked-by id, without eating the next word",
    parseTaskLine("- [ ] Ship the deck \u{26D4} c17efa", WEEK, 0).title,
    "Ship the deck"
  );
  check(
    "a bare id line still has a title left",
    parseTaskLine("- [ ] \u{1F194} abc123 Call Jim", WEEK, 0).title.includes("Call Jim"),
    true
  );

  // A cancelled task is not an open one, whatever the theme calls it.
  const cancelled = parseTaskLine("- [-] Abandoned idea", WEEK, 0);
  check("a cancelled marker is not open", cancelled.status, "done");
  check("and is flagged as cancelled", cancelled.cancelled, true);

  // An unjudged task under an ordinary heading stays unjudged — the inference
  // has to be narrow or every task on every page becomes important.
  const plain = parseTaskLine("- [ ] Book the car", WEEK, 0, { heading: "Errands" });
  check("an ordinary heading infers nothing", plain.important, null);
  check("with no provenance to show", plain.importantFrom, null);
}

// --- 0.10: week-number tokens ---------------------------------------------
//
// John's vault is Sunday-start: the page he wrote for the week beginning
// Sunday 22 Nov 2026 is `Week 48 of 2026`, where ISO-8601 calls that date week
// 47. Getting this wrong points the panel at an adjacent week's file, which
// looks exactly like the feature not working.

{
  const { weekNumber, weekYear, expandPathTokens, parseScope, scopeIncludesPath, removePathFromScope } = mod.scope;
  const NOV22 = new Date(2026, 10, 22); // a Sunday
  const NOV28 = new Date(2026, 10, 28); // the Saturday that closes that week

  check("Sunday-start puts 22 Nov 2026 in week 48", weekNumber(NOV22, "sunday"), 48);
  check("and the Saturday after it in the same week", weekNumber(NOV28, "sunday"), 48);
  check("the Saturday before it is week 47", weekNumber(new Date(2026, 10, 21), "sunday"), 47);
  check("ISO-8601 disagrees by one, as expected", weekNumber(NOV22, "monday"), 47);

  const PATTERN = "2. Day Planners/Weeks/Week {{week}} of {{year}}.md";
  check(
    "the pattern resolves to the real file",
    expandPathTokens(PATTERN, NOV22, "sunday"),
    "2. Day Planners/Weeks/Week 48 of 2026.md"
  );
  check("zero-padding is available", expandPathTokens("W{{week:02}}.md", new Date(2026, 0, 5), "sunday"), "W02.md");
  check("a path without tokens is untouched", expandPathTokens("Tasks.md", NOV22, "sunday"), "Tasks.md");
  // 1 Jan 2027 is a Friday; its week's Thursday is 31 Dec 2026, so ISO puts it
  // in 2026 — which is the case that would otherwise resolve to a nonexistent file.
  check("the year follows the week, not the date", weekYear(new Date(2027, 0, 1), "monday"), 2026);
  check("Sunday-start just uses the calendar year", weekYear(new Date(2027, 0, 1), "sunday"), 2027);

  const scope = parseScope(`Tasks.md, ${PATTERN}`, { today: NOV22, weekStart: "sunday" });
  check("the expanded path is what gets scanned", scope.entries[1].path, "2. Day Planners/Weeks/Week 48 of 2026.md");
  check("capture still targets the first file", mod.scope.primaryManagedFile(scope), "Tasks.md");
  check(
    "an unexpanded token is dropped, not scanned literally",
    parseScope("Tasks.md, Week {{quarter}}.md", { today: NOV22 }).entries.length,
    1
  );
  check(
    "tokens off means the brace entry is skipped too",
    parseScope(`Tasks.md, ${PATTERN}`, { today: NOV22, expandTokens: false }).entries.length,
    1
  );

  // Right-click on the live week page has to resolve to the pattern, or the
  // toggle appends a second frozen copy of today's path and "stop tracking"
  // appears to do nothing.
  const raw = `Tasks.md, ${PATTERN}`;
  const live = "2. Day Planners/Weeks/Week 48 of 2026.md";
  check("the live page counts as already tracked", scopeIncludesPath(raw, live, { today: NOV22 }), true);
  check(
    "untracking it removes the pattern",
    removePathFromScope(raw, live, { today: NOV22 }),
    "Tasks.md"
  );
  check("next week's page is not tracked by today's expansion", scopeIncludesPath(raw, "2. Day Planners/Weeks/Week 49 of 2026.md", { today: NOV22 }), false);
}

// ======================================================================
// 0.11 — one vocabulary. Plain `[word:: value]` is what gets written; emoji
// stays readable forever, because the week page and the OmniFocus import are
// full of it and a line the parser can't read is a task that disappears.
// ======================================================================

{
  console.log("\n[0.11 vocabulary — words are read as well as emoji]");

  const words = parseTasksFromContent(
    "- [ ] Call the propane place [due:: 2026-11-28] [defer:: 2026-11-25]",
    "Tasks.md"
  )[0];
  check("[due::] read", d(words.due), "2026-11-28");
  check("[defer::] read", d(words.defer), "2026-11-25");
  check("fields never leak into the title", words.title, "Call the propane place");

  const emoji = parseTasksFromContent(
    "- [ ] Call the propane place 📅 2026-11-28 ⏳ 2026-11-25",
    "Tasks.md"
  )[0];
  check("emoji still read", d(emoji.due), "2026-11-28");
  check("emoji defer still read", d(emoji.defer), "2026-11-25");

  // A half-converted line is the realistic case: something wrote the field,
  // the emoji is still sitting there. The field wins because it's the notation
  // this version emits, so the most recent write is the one that counts.
  const mixed = parseTasksFromContent(
    "- [ ] Half-converted 📅 2026-11-20 [due:: 2026-11-28]",
    "Tasks.md"
  )[0];
  check("the field wins over a leftover emoji", d(mixed.due), "2026-11-28");

  const doneWords = parseTasksFromContent("- [x] Shipped it [done:: 2026-11-22]", "Tasks.md")[0];
  check("[done::] read", d(doneWords.doneDate), "2026-11-22");

  console.log("\n[0.11 — priority in words]");
  for (const [word, expected] of [
    ["highest", "highest"],
    ["urgent", "highest"],
    ["high", "high"],
    ["normal", "medium"],
    ["low", "low"],
    ["lowest", "lowest"],
  ]) {
    check(
      `[priority:: ${word}]`,
      parseTasksFromContent(`- [ ] Thing [priority:: ${word}]`, "Tasks.md")[0].priority,
      expected
    );
  }
  check(
    "⏫ still read",
    parseTasksFromContent("- [ ] Thing ⏫", "Tasks.md")[0].priority,
    "high"
  );
  check(
    "the word beats the emoji on a mixed line",
    parseTasksFromContent("- [ ] Thing ⏬ [priority:: high]", "Tasks.md")[0].priority,
    "high"
  );
  check(
    "nonsense priority is unjudged, not a crash",
    parseTasksFromContent("- [ ] Thing [priority:: ASAP!!]", "Tasks.md")[0].priority,
    null
  );

  // Morgen sends real estimates (PT30M), so effort has to accept a duration,
  // not just the four bucket words. The bucket is a ceiling — 30m fits inside
  // an hour, so it's heavy — and the number is kept alongside it, because
  // throwing it away loses the only part Morgen actually said.
  console.log("\n[0.11 — effort accepts durations, keeps the number]");
  for (const [value, bucket, mins] of [
    ["light", "light", null],
    ["deep", "deep", null],
    ["2m", "light", 2],
    ["3 min", "light", 3],
    ["10 minutes", "moderate", 10],
    ["30m", "heavy", 30],
    ["1h", "heavy", 60],
    ["1.5 hours", "deep", 90],
    ["2 hrs", "deep", 120],
  ]) {
    const t = parseTasksFromContent(`- [ ] Thing [effort:: ${value}]`, "Tasks.md")[0];
    check(`[effort:: ${value}] → ${bucket}`, t.effort, bucket);
    check(`  and keeps ${mins === null ? "no number" : `${mins}m`}`, t.effortMinutes, mins);
  }
  const junkEffort = parseTasksFromContent("- [ ] Thing [effort:: a while]", "Tasks.md")[0];
  check("unparseable effort is null, not a wrong bucket", junkEffort.effort, null);
  check("0m is not an effort", parseTasksFromContent("- [ ] Thing [effort:: 0m]", "Tasks.md")[0].effort, null);

  // The round trip that matters: a line written by this version has to parse
  // back to exactly what was asked for, with no emoji anywhere on it.
  console.log("\n[0.11 — write/read round trip is emoji-free]");
  const legacy = parseTasksFromContent(
    "- [ ] Legacy line 📅 2026-11-04 ⏳ 2026-11-01 🔁 every week [pushes:: 1]",
    "Tasks.md"
  )[0];
  const touched = mod.writer.buildPatchedLine(legacy, { due: new Date(2026, 10, 30) });
  check("converted on touch", /\[due:: 2026-11-30\]/.test(touched), true);
  check("no emoji due left", /📅/.test(touched), false);
  check("the untouched emoji defer is left alone", /⏳ 2026-11-01/.test(touched), true);
  check("recurrence is never ours to rewrite", /🔁 every week/.test(touched), true);
  check("and it reads back", d(parseTasksFromContent(touched, "Tasks.md")[0].due), "2026-11-30");
}

// ======================================================================
// 0.11 — the clean slate. One command draws a line under an imported
// backlog: the lines move under `## Archive` and the panel stops seeing
// them. It must never delete, and never mark anything done.
// ======================================================================

{
  console.log("\n[0.11 archive — the section is invisible to the scan]");

  const WITH_ARCHIVE = [
    "# Tasks",
    "",
    "- [ ] Live task",
    "",
    "## Archive",
    "",
    "- [ ] Old thing [archived:: 2026-11-23]",
    "- [ ] Another old thing",
    "",
    "## Later",
    "",
    "- [ ] Still live",
  ].join("\n");

  const seen = parseTasksFromContent(WITH_ARCHIVE, "Tasks.md");
  check("archived tasks are not scanned", seen.length, 2);
  check("the live one before it survives", seen[0].title, "Live task");
  // The heading after the archive section has to end it, or everything below
  // the sweep disappears forever — including next week's work.
  check("a later heading re-opens the scan", seen[1].title, "Still live");
  check("archive is not an inherited state", seen[1].heading, "Later");

  console.log("\n[0.11 archive — the sweep moves, stamps, and deletes nothing]");

  const { buildArchivedContent } = mod.writer;
  const BACKLOG = [
    "# Task tracker",
    "",
    "## Fund 4.0 Prep",
    "",
    "- [ ] Fund 4 build to 30M [important:: true]",
    "    - [ ] Call the LPs",
    "    - note: the deck is in Dropbox",
    "- [x] Already done 📅 2026-10-01",
    "",
    "### Later",
    "",
    "- [ ] Someday thing [stream:: 7f3c-aa]",
    "",
    "```tasks",
    "not done",
    "```",
  ].join("\n");

  const openLines = parseTasksFromContent(BACKLOG, "T.md")
    .filter((t) => t.status === "open")
    .map((t) => t.lineNumber);
  check("three open tasks to sweep", openLines.length, 3);

  const swept = buildArchivedContent(BACKLOG, openLines, new Date(2026, 10, 23));
  console.log(swept.content.split("\n").map((l) => `    ${l}`).join("\n"));

  // The count is top-level items, not lines: the child moved as part of its
  // parent's span, so claiming "3 archived" when the user sees two entries
  // would be the dialog lying about what it did.
  check("parent and its child counted once", swept.moved, 2);

  const after = parseTasksFromContent(swept.content, "T.md");
  check("the panel sees nothing left", after.filter((t) => t.status === "open").length, 0);
  check("the completed line stays where it was", /## Fund 4\.0 Prep[\s\S]*- \[x\] Already done/.test(swept.content), true);

  // Not deleted, not done — the two failure modes that would make this command
  // unusable. Every open line is still on disk, still open.
  check("nothing was deleted", /Fund 4 build to 30M/.test(swept.content), true);
  check("the sub-task came with it", /Call the LPs/.test(swept.content), true);
  check("so did its note bullet", /note: the deck is in Dropbox/.test(swept.content), true);
  check("the stream id survives", /\[stream:: 7f3c-aa\]/.test(swept.content), true);
  check("nothing was ticked", /- \[x\] Fund 4/.test(swept.content), false);
  check("archived date stamped on the parent", /Fund 4 build to 30M.*\[archived:: 2026-11-23\]/.test(swept.content), true);
  check("and on the child", /Call the LPs \[archived:: 2026-11-23\]/.test(swept.content), true);
  check("but not on a prose bullet", /Dropbox \[archived/.test(swept.content), false);
  check("one Archive heading", (swept.content.match(/^## Archive$/gm) || []).length, 1);
  check("the fence is intact", /```tasks\nnot done\n```/.test(swept.content), true);
  check("the fence stayed out of the archive", swept.content.indexOf("```tasks") < swept.content.indexOf("## Archive"), true);

  // Running it again has to be a no-op, or a second invocation re-stamps and
  // re-nests everything that already moved.
  const again = buildArchivedContent(
    swept.content,
    parseTasksFromContent(swept.content, "T.md").filter((t) => t.status === "open").map((t) => t.lineNumber)
  );
  check("re-running moves nothing", again.moved, 0);
  check("and changes nothing", again.content, swept.content);

  // A file that already has an Archive section gets appended to, not given a
  // second one.
  const SECOND = ["## Archive", "", "- [ ] Old [archived:: 2026-11-01]", "", "## Now", "", "- [ ] New"].join("\n");
  const secondSweep = buildArchivedContent(
    SECOND,
    parseTasksFromContent(SECOND, "T.md").filter((t) => t.status === "open").map((t) => t.lineNumber),
    new Date(2026, 10, 23)
  );
  check("appends to the existing section", (secondSweep.content.match(/^## Archive$/gm) || []).length, 1);
  check("the new item joined it", /- \[ \] New \[archived:: 2026-11-23\]/.test(secondSweep.content), true);
  check("above the heading that followed", secondSweep.content.indexOf("- [ ] New") < secondSweep.content.indexOf("## Now"), true);
  check("the earlier archived item is untouched", /- \[ \] Old \[archived:: 2026-11-01\]/.test(secondSweep.content), true);
  check("and the file is clean again", parseTasksFromContent(secondSweep.content, "T.md").length, 0);

  check("an empty sweep is a no-op", buildArchivedContent(BACKLOG, []).content, BACKLOG);
}

console.log("\n=== INLINE / MENU ===");
{
  const { triggerQuery, applyAction, ACTIONS } = mod.suggest;

  // The three rows, verbatim as John specified them. One line each, lowercase,
  // no verb — the menu is the whole explanation.
  check("row labels", ACTIONS.map((a) => a.label).join(" | "),
    "task, triage later | important | urgent (due in two days)");
  check("no second line on any row", ACTIONS.every((a) => !("hint" in a)), true);

  // Fires: there is a sentence in front of the slash.
  check("fires at the end of a line", triggerQuery("this is a test task/"), "");
  check("carries the typed filter", triggerQuery("call the vet/imp"), "imp");
  check("fires inside an existing task", triggerQuery("- [ ] call the vet/"), "");

  // Refuses: the slash means something else. Each of these is a menu that
  // would otherwise cover text mid-sentence.
  check("not on a bare slash", triggerQuery("/"), null);
  check("not on an empty line", triggerQuery("   /"), null);
  check("not in a date", triggerQuery("due 11/"), null);
  check("not in a URL", triggerQuery("see https://"), null);
  check("not in a path", triggerQuery("open src/main.ts/"), null);
  check("not after a word boundary slash", triggerQuery("and/or/"), null);

  const today = new Date(2026, 10, 24);

  // Plain text becomes a task; a bullet keeps its bullet; a task keeps itself.
  check("plain line becomes a task", applyAction("get the milk", "plain", today), "- [ ] get the milk");
  check("a bullet gains a checkbox", applyAction("- get the milk", "plain", today), "- [ ] get the milk");
  check("indent survives", applyAction("    - get the milk", "plain", today), "    - [ ] get the milk");
  check("a numbered item keeps its number", applyAction("1. get the milk", "plain", today), "1. [ ] get the milk");
  check("an existing task is left alone", applyAction("- [ ] get the milk", "plain", today), "- [ ] get the milk");
  check("a done task is not reopened", applyAction("- [x] get the milk", "plain", today), "- [x] get the milk");

  check(
    "important writes a word, not an emoji",
    applyAction("get the milk", "important", today),
    "- [ ] get the milk [important:: true]"
  );
  check(
    "urgent is a due date two days out",
    applyAction("get the milk", "urgent", today),
    "- [ ] get the milk [due:: 2026-11-26]"
  );
  check(
    "an existing due date is replaced, not duplicated",
    applyAction("- [ ] pay tax [due:: 2026-12-31]", "urgent", today),
    "- [ ] pay tax [due:: 2026-11-26]"
  );
  check(
    "marking important leaves other fields intact",
    applyAction("- [ ] pay tax [effort:: moderate]", "important", today),
    "- [ ] pay tax [effort:: moderate] [important:: true]"
  );

  // The whole point of the vocabulary change: nothing here emits emoji.
  const written = ["plain", "important", "urgent"].map((a) => applyAction("x", a, today)).join(" ");
  check("no emoji written anywhere", /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(written), false);

  // And what it writes has to be readable by the thing that reads tasks.
  const roundTrip = parseTasksFromContent(applyAction("get the milk", "urgent", today), "T.md");
  check("the line parses back as one task", roundTrip.length, 1);
  check("with the due date it claimed", d(roundTrip[0]?.due), "2026-11-26");
  check("and a clean title", roundTrip[0]?.title, "get the milk");
}

console.log(
  `\n${failures === 0 ? "ALL ASSERTIONS PASSED" : `${failures} ASSERTION(S) FAILED`}\n`
);
process.exit(failures === 0 ? 0 : 1);
