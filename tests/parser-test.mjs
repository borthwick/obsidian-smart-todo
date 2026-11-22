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
   module.exports = { Notice, TFile, Modal };\n`
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
const pushed = buildPushedLine(marta, 1);
console.log(`  pushed: ${pushed.trim()}`);
check("due advanced by 1 day", /📅 2026-11-05/.test(pushed), true);
check("pushes incremented 1→2", /\[pushes:: 2\]/.test(pushed), true);
check("defer untouched", /⏳ 2026-11-01/.test(pushed), true);

const noPushes = tasks.find((t) => t.title.startsWith("Review the Q4"));
const pushedNew = buildPushedLine(noPushes, 1);
console.log(`  pushed (no due, no defer, no pushes field): ${pushedNew.trim()}`);
check("pushes field appended as 1", /\[pushes:: 1\]/.test(pushedNew), true);
check("undated task gets a due date", /📅 \d{4}-\d{2}-\d{2}/.test(pushedNew), true);

const doneLine = buildToggledLine(marta, true);
console.log(`  completed: ${doneLine.trim()}`);
check("checkbox flipped to [x]", /^- \[x\]/.test(doneLine.trim()), true);
check("✅ stamped with today", doneLine.includes(`✅ ${formatDate(new Date())}`), true);

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
check("due removed", /📅/.test(cleared), false);
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

console.log(
  `\n${failures === 0 ? "ALL ASSERTIONS PASSED" : `${failures} ASSERTION(S) FAILED`}\n`
);
process.exit(failures === 0 ? 0 : 1);
