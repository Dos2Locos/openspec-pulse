# Board preview fixture

Original sample content, including deliberately inert script/image HTML and unsafe links.
No prompts or external requests are made by the preview host.

Run `npm run media:preview` and visit:

1. `/panel?view=board&theme=light&scenario=board-many`: four state columns, folded archive with 85 rows (40/80/85 pages).
2. `/panel?view=board&theme=dark&scenario=delivery-merged`: independent delivery signals; sibling worktree is read only.
3. `/panel?view=detail&theme=light`: shared artifact preview in the sidebar.
4. `/panel?view=board&theme=light&scenario=board-error`: artifact error keeps Open in editor.
5. `/panel?view=board&theme=dark&scenario=board-empty`: empty board.

From a filtered card, Enter opens detail; Escape closes preview first, then returns to the board
with the original filter and focus. Archive opens the command preview; Cancel records no send.
The sample host exposes `previewChange()` to simulate completed tasks and a shared invalidation,
and `previewSwitchWorkspace('other')` to invalidate the board without loading another project.
The real worker concurrency/file-watcher tests live in `src/worker.test.ts`.

Bootstrap regression: `/panel?view=board&scenario=board-no-replay` suppresses the initial
workspace event. The explicit context read must still produce 4 columns and 4 fixture cards.
