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
const FIXTURE = process.argv[2] || "/tmp/smart-todo-test/sample-tasks.md";

const outdir = mkdtempSync(join(tmpdir(), "smart-todo-test-"));
const outfile = join(outdir, "bundle.cjs");

// Minimal stand-in for the few `obsidian` runtime values writer.ts touches.
const obsidianStub = join(outdir, "obsidian-stub.cjs");
writeFileSync(
  obsidianStub,
  `class Notice { constructor(m) { this.message = m; } }
   class TFile {}
   module.exports = { Notice, TFile };\n`
);

await esbuild.build({
  stdin: {
    contents: `
      export * from "./src/parser";
      export * as filters from "./src/filters";
      export * as writer from "./src/writer";
      export * as scope from "./src/scope";
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

console.log(
  `\n${failures === 0 ? "ALL ASSERTIONS PASSED" : `${failures} ASSERTION(S) FAILED`}\n`
);
process.exit(failures === 0 ? 0 : 1);
