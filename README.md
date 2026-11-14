# Smart ToDo

Effort-aware task triage for [Obsidian](https://obsidian.md). A Today view over
plain markdown checkboxes, scoped to the files you actually manage.

**Install via BRAT:** add `borthwick/obsidian-smart-todo`

## Why

Most task plugins either scan the whole vault — drowning you in every stale
checkbox from two years of meeting notes — or make you adopt a database that
only that plugin can read. Smart ToDo does neither. It reads an **opt-in set of
files**, and a task is just a markdown list item.

## Storage model

No database. A task is a markdown line, encoded the way the
[Tasks](https://publish.obsidian.md/tasks/) plugin (emoji dates) and
[Dataview](https://blacksmithgu.github.io/obsidian-dataview/) (inline
`[key:: value]` fields) already encode it:

```markdown
- [ ] Draft the migration plan 📅 2026-11-04 ⏳ 2026-11-01 [effort:: heavy] [pushes:: 1] [project:: Platform]
```

| Token | Meaning |
| --- | --- |
| `📅 YYYY-MM-DD` | Due date |
| `⏳ YYYY-MM-DD` | Defer — the task rests, hidden from Today, until this date |
| `✅ YYYY-MM-DD` | Completion date, stamped when you tick the box |
| `[effort:: light\|moderate\|heavy]` | How much capacity it needs |
| `[pushes:: n]` | How many times you've deferred it by a day |
| `[project:: …]`, `[assigned:: …]` | Free-text grouping |

Every task stays readable and editable with this plugin uninstalled, and your
existing Tasks / Dataview queries keep working against the same lines.

## Managed scope

Smart ToDo only reads files listed in **Settings → Smart ToDo → Managed files**.
Everything else in the vault is invisible to it.

- Default: `Tasks.md` at the vault root, created automatically if missing.
- An entry ending in `.md` is a single file; anything else is treated as a
  folder and all `.md` files beneath it are included (recursively).
- Comma- or newline-separated, so `Tasks.md, Projects/Active` works.
- A blank setting falls back to the default file — it never opens up to the
  whole vault, since that's the state you'd least want to hit by accident.

The settings tab shows how many vault files your scope currently matches, so a
typo'd path doesn't fail silently.

## Views

Five tabs, all derived from the same lines:

- **Today** — open, not resting, due today or earlier.
- **This Week** — open, not resting, due within the next 7 days.
- **Overdue** — open and past due. Shown *regardless of defer*: a past due date
  with a future defer is a contradiction you should see, not one the plugin
  should quietly resolve.
- **Backlog** — open but not actionable today: resting, undated, or future-dated.
- **Completed** — most recently finished first.

Today and This Week report how many tasks are **resting in the backlog**. That
count is the whole point of defer — knowing what you've deliberately chosen not
to look at is what makes a short list trustworthy.

### Ordering

Overdue block first, then due-today. Within a block: longest-overdue first, then
heavier effort before lighter (the hard thing is the one that keeps sliding),
then the most-pushed task. A high push count is the signal that something needs
to either happen or be killed.

## Capture and triage

- Type in the box at the top of the view and press Enter, or run the
  **Smart ToDo: Add task** command. Appends `- [ ] <text>` to the managed file —
  title only, so capture never blocks on metadata.
- Tick the checkbox to complete; it stamps `✅` with today's date. Un-ticking
  strips the stamp, so a mis-click leaves no residue.
- The `»` button pushes a task out one day and increments `[pushes:: n]`.
- Right-click an effort pill to retag it.
- Click a task title to jump to its source line.

## Write safety

The view can be seconds stale — you may have edited the note, or Sync may have
landed a change. So every mutation **replaces exactly one line**, and only after
confirming that line still holds the text that was parsed. If the line moved, a
whole-file search runs but only accepts a *unique* match; two identical task
lines are ambiguous and the write is refused rather than guessed. Writes go
through `vault.process` so a concurrent edit can't interleave. Files are never
rewritten wholesale.

## Development

```bash
npm install
npm run dev          # watch build
npm run build        # typecheck + production bundle
npm run test:parser  # parser / scope / write-back assertions, no Obsidian host needed
```

`src/parser.ts`, `src/filters.ts` and `src/scope.ts` only `import type` from
`obsidian`, so the parsing, triage and scope rules bundle and run in plain node.

## License

MIT
