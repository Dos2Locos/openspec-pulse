# Publishing OpenSpec Pulse

Prepared for the [Orca community directory](https://orca.dev/plugins/add).
The directory lists tagged releases, not the current default branch. This guide prepares
publication; running the publishing commands below makes the plugin public in the directory.

## Listing

| Field | Value |
| --- | --- |
| Repository | `Dos2Locos/openspec-pulse` (public, not a fork) |
| Name | OpenSpec Pulse |
| Plugin ID | `openspec-pulse` |
| Publisher / installed key | `dos2locos` / `dos2locos.openspec-pulse` (local folders use `local.openspec-pulse`) |
| Version / tag | `0.1.0` / `v0.1.0` |
| Requires | Orca desktop `>=1.4.259`, local workspace |
| License | MIT |
| Description | Track OpenSpec changes, task progress, archived proposals and specs in Orca's sidebar. Continue the next step with Claude Code. |
| Support | <https://github.com/Dos2Locos/openspec-pulse/issues> |
| Listing status | <https://orca.dev/plugins/Dos2Locos/openspec-pulse> |

The explicit `publisher` matches the GitHub repository owner, normalized to lowercase as the
manifest requires. New Orca versions derive this
identity from the source repository. Keep the owner, repository URLs and installed key in sync
if the project moves.

## Images

All marketplace images are referenced in `orca-plugin.json`, have alternative text and are
committed with the release. Orca copies them from the tagged repository.

| File | Size | Purpose |
| --- | --- | --- |
| `media/cover.jpg` | 1600×1000 | Cover, 16:10 |
| `media/workflow-light.png` | 1600×1000 | Active change list and task detail, light theme |
| `media/workflow-dark.png` | 1600×1000 | Active change list and task detail, dark theme |
| `media/archive-specs.png` | 1600×1000 | Archive and shared specs |

The gallery captures the **shipping panel modules and CSS** in a browser, with a small sample
host and presentation frame. It is not an AI mockup or a capture of the whole Orca window.
Sample data is synthetic; the preview cannot read workspaces, write project files or launch
agents. Theme tokens are supplied by the preview, so individual colors depend on the user's
chosen Orca theme. Existing `media/panel-light.png` and `media/panel-dark.png` are historical
340×600 captures and are not submitted to the directory.

To reproduce the gallery:

```sh
npm ci
npm run media:preview
```

Capture these URLs at a viewport of **1600×1000 CSS pixels**, scale 1, once both panels load:

1. `http://127.0.0.1:4177/?view=workflow&theme=light` → `media/workflow-light.png`
2. `http://127.0.0.1:4177/?view=workflow&theme=dark` → `media/workflow-dark.png`
3. `http://127.0.0.1:4177/?view=library&theme=light` → `media/archive-specs.png`

In Orca's browser, apply `orca viewport --page <id> --width 1600 --height 1000` **after
each navigation**. Retina captures may still be 3200×2000 physical pixels; downsample them
to 1600×1000 before submission (for example with macOS `sips -z 1000 1600 <file.png>`).

The server binds only to `127.0.0.1:4177`. Stop it with Ctrl+C after capture.
Review every PNG: no clipped tasks, loading messages, errors or private workspace data.

The cover was generated with the built-in `imagegen` tool and exported as JPEG at 1600×1000.
Prompt:

> Use case: ads-marketing. Create a polished marketplace cover for the developer tool
> "OpenSpec Pulse", a community plugin for Orca that tracks specification changes and task
> progress. Wide 16:10 composition, ideally 1600x1000. Deep charcoal background, restrained
> warm white typography, lime and mint highlights. Editorial Swiss typography, crisp flat
> graphic design. Exact large title on left: "OpenSpec" on one line, "Pulse" below. Small
> subtitle: "Your specs. In motion." Right half: an elegant abstract stack of three rounded
> specification sheets with minimal progress lines and check marks, connected by a single
> pulse line; convey drafting, implementation, completion. Bottom small text: "A community
> plugin for Orca". No app screenshots, no fake readable UI, no Orca logo, no extra text,
> no watermarks. Sophisticated, calm, highly legible thumbnail.

## Validate before tagging

```sh
npm ci
npm run typecheck
npm test
npm run validate
git diff --check
```

Use the current Orca CLI. Its plugin validator checks local manifests and image constraints.
For the exact directory check, from a checkout of
[Orca](https://github.com/stablyai/orca), also run:

```sh
pnpm validate:plugin /absolute/path/to/openspec-pulse
```

The directory additionally checks repository visibility, tags, publisher, license, prohibited
binary content and its takedown list. Local validation does not guarantee directory approval.
Do not commit `node_modules/`, `.orca/`, executables, archives, symlinks or native binaries.
Images are allowed. Confirm all four listing images are tracked in the tagged commit.

## Publish when ready

1. Commit the prepared files and push the commit to `origin`. The manifest and package
   version must both be `0.1.0`. Confirm the working tree is clean.
2. Create and push the version tag for that exact commit:

   ```sh
   git tag -a v0.1.0 -m 'OpenSpec Pulse 0.1.0'
   git push origin v0.1.0
   ```

3. Enable discovery:

   ```sh
   gh repo edit Dos2Locos/openspec-pulse --add-topic orca-plugin
   ```

4. Check [the plugin status page](https://orca.dev/plugins/Dos2Locos/openspec-pulse).
   The directory normally discovers valid releases within an hour and reports any rejection
   there. The initial listing is **Community · unreviewed**; do not describe it as official.
5. Install the tagged release in Orca and verify the cover, screenshots and README links.

For later releases, update both version fields, commit all changes and push a new `vX.Y.Z`
tag. Pushing a new commit without a new version tag does not update the marketplace release.
