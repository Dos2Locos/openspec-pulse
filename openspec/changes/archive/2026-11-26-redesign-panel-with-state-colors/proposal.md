# Proposal

## Why

The panel works but is flat. Every card, badge and progress bar is the same grey. It shows no
state, and nothing says which change is finished, which is moving or what to do next.

The panel is a `components` panel. That limits colour to five tones on badges and buttons, and
its progress bar cannot take any colour. The panels people install on orca.dev/plugins are html
panels with their own CSS over Orca's theme variables: Pitwall, Fleet Monitor, Beads Board and
Activity Monitor. They share a few patterns:

- **Pitwall**: a summary line with coloured dots (`● 1 need you ● 1 working ● 1 idle`). Cards
  have a coloured status pill (`Working 45s`), a progress bar in a state colour and a highlighted
  card for what needs attention. A `This | All` segmented switch sits in the header.
- **Fleet Monitor**: dense cards with a coloured stripe and a status label (`OK`, `Busy`,
  `Strained`). It shows big numbers in the state colour and a status bar item that opens the
  panel.
- **Beads Board**: columns per state (Ready, In progress, Blocked, Closed) with a coloured dot and
  a count each. Cards are compact, with a small id and labels.
- **Activity Monitor**: a status bar item whose tone says the health (`Critical` in `danger`).

## What Changes

- **BREAKING (internal)**: the panel becomes an html panel (`"ui": "html"`, a `.ts` entry with no
  build step). It uses its own CSS built on Orca's `--orca-*` theme variables, in light and dark.
  `src/panel.tsx`, `src/actions.tsx`, `src/panel.test.tsx` and `src/panel.check.ts` are replaced.
  The worker's requests and events (`src/protocol.ts`) stay as they are, except one added field.
- **Plugin header** (like Enhance Prompt's and Fleet Monitor's):
  - first line: a small icon tile (the `layers` glyph on the primary colour), **OpenSpec Pulse**
    in bold and the version (`v0.1.0`) muted;
  - second line: a muted subtitle with the workspace and its state (`rabbitfish · 2 changes`,
    `No OpenSpec here`, `No workspace`);
  - on the right, icon buttons: `+` (New proposal), Explore and refresh. The separate row with the
    two start buttons goes away.
- **Summary strip** under the header: one line of
  coloured dots with counts per state (`● 2 in progress ● 1 ready to archive ○ 1 not started`).
  Each dot filters the list to that state, like Pitwall's switch. Pressing it again clears the
  filter.
- **Change cards with state** (inspired by Fleet Monitor and Pitwall):
  - a 3px coloured stripe on the left and a state pill (`In progress`, `Ready to archive`,
    `Not started`, `Drafting`);
  - a progress bar coloured by its share done, from red through yellow to green, with `5/12` beside it;
  - a lifecycle stepper `proposal › specs › design › tasks`, with each artifact done, missing or
    next;
  - the time since the change was last edited (`edited 5 min ago`), with the list sorted by it;
  - the four action buttons (continue, apply, verify, archive) as icons, with **the next step
    filled** (`Continue: design`, `Apply` or `Archive` in its tooltip).
- **Detail view**: the same header card, then the artifacts as rows, then the task sections, each
  with a small progress bar of its own and its tasks as checkboxes. Long tasks still expand.
- **Status bar item** (new): the `layers` icon and `2 changes · 5/12`. It is `accent` while tasks
  are pending, `success` when all are done and `neutral` with none. Its tooltip lists the changes.
  It is hidden without readable OpenSpec and stays current with the panel closed. Pressing it opens
  the panel, as in Fleet Monitor.
- **Colour budget, so it does not look like a fairground**:
  - colour only on state (the stripe, pill, bar and dot) and on the one primary button per card;
  - the rest uses Orca's neutral surfaces;
  - no gradients and no tinted card backgrounds, except a faint tint on the card that is ready
    to archive;
  - red only for errors and for the low end of a progress bar.

Out of scope:

- showing which agent is working on a change;
- editing tasks from the panel;
- settings for custom colours (Fleet Monitor has them);
- browser clients (`orca serve`), where html panels need inlined assets.

## Capabilities

### New Capabilities

- `status-bar-summary`: the status bar item: its text, tone, tooltip and visibility, and pressing
  it to open the panel.
- `change-state-display`: how each change is classified and coloured. Covers the cards, the
  summary strip and its filter, recency, the detail view, and following Orca's theme.
- `change-next-step`: the lifecycle stepper and the single primary action derived from a change's
  artifacts and tasks.

### Modified Capabilities

None: `openspec/specs/` is empty. The behaviour of the existing agent buttons (what they send and
where) does not change; only how they are laid out does.

## Impact

- `orca-plugin.json`:
  - the panel becomes `"ui": "html"` with a `.ts` entry;
  - adds `statusBarItems`, a `commands` entry for opening the panel and `events`
    (`workspace.changed`);
  - `engines.orca` stays `>=1.4.248`.
  - Orca will ask to approve the plugin again.
- New `src/panel/`: the entry, rendering and CSS. New pure modules for state, next step and
  summary, with Node tests.
- `src/openspec.ts` and `src/protocol.ts`: each change gains `updatedAt` (the newest file mtime in
  its folder).
- `src/worker.ts`: status bar updates, a `workspace.changed` handler, and the command that opens
  the panel through Orca's CLI (it already runs that CLI for chats).
- Tests: the components-panel tests go. The pure modules get unit tests. The visuals are checked
  with `orca plugin shot` in light and dark, because `orca plugin check` only renders components
  panels.
- Accessibility is now ours to provide, which components did for free: focus order, keyboard
  access, ARIA for the filter and the icon buttons, and contrast in both themes.
- No new dependencies. One new capability, `storage:own`, so the html panel can keep the selected change per workspace in `orca.storage` (the components panel did it with a `persist` atom).
