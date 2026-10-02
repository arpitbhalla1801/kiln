# Business Journey Tests

Kiln's product promise is: a developer can turn a Bun Next.js app into a capability-managed project without hand-editing ownership, env files, or auth scaffolding. These tests are the end-to-end proof that promise still holds after every change — they treat kiln as a shipped CLI, running against `apps/cli/dist/index.js` after a full build, the same artifact a git-clone user (and later an npm user) would execute.

Use them as a **release gate on every version upgrade**.

## Journeys

| Journey | What a version upgrade must not break |
|---------|----------------------------------------|
| CLI contract | Help, version, and error messages stay usable |
| New project | `init` → `add env` → `add auth` → `doctor` → `build` |
| Existing project | The example app still inspects, doctors, and builds |
| Re-apply | Running the same capability twice is a no-op |
| Edit-then-re-apply | A hand-edited kiln-owned file survives `add auth` twice and the project still builds |
| Plugin | `init-plugin` output installs from npm, then verify, plan, add and remove work |

The machine-readable catalog is [`catalog.json`](./catalog.json). IDs (`PD-01` … `PD-23`) match test names and stay stable across the rename.

## Local

```bash
bun install
bun run build
bun run test:business-journeys
```

`test:business-journeys` does **not** replace unit tests. Keep `bun test` for package-level coverage and this suite for business-level smoke.

## Wire into a version upgrade / deploy pipeline

After the version is built (tag, GitHub Release, or future npm publish):

```bash
bun run build
bun run test:business-journeys
```

Suggested GitHub Actions trigger (already in `.github/workflows/business-journeys.yml`):

- `push` of tags `v*`
- `workflow_dispatch` for a manual run
- pull requests, so upgrades are verified before merge

Exit code is non-zero if any business journey fails. Treat **blocker** catalog cases as release-blocking.

## What is intentionally not here

Unit tests for VFS, planner, and ownership stay in `packages/*/tests`. This suite only covers end-user behavior that would fail a customer after they upgrade kiln.
