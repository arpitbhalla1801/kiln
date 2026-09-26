# Post-deploy / version-upgrade tests

These tests treat kiln as a shipped CLI. They run against `apps/cli/dist/index.js` after a full build, which is the same artifact a git-clone user (and later an npm user) would execute.

Use them as a **post-deploy gate on every version upgrade**.

## Business journeys

Kiln's product promise is: a developer can turn a Bun Next.js app into a capability-managed project without hand-editing ownership, env files, or auth scaffolding.

| Journey | What a version upgrade must not break |
|---------|----------------------------------------|
| CLI contract | Help, version, and error messages stay usable |
| New project | `init` → `add env` → `add auth` → `doctor` → `build` |
| Existing project | The example app still inspects, doctors, and builds |
| Re-apply | Running the same capability twice is a no-op |

The machine-readable catalog is [`catalog.json`](./catalog.json). IDs (`PD-01` … `PD-23`) match test names.

## Local

```bash
bun install
bun run build
bun run test:post-deploy
```

`test:post-deploy` does **not** replace unit tests. Keep `bun test` for package-level coverage and this suite for upgrade smoke.

## Wire into a version upgrade / deploy pipeline

After the version is built (tag, GitHub Release, or future npm publish):

```bash
bun run build
bun run test:post-deploy
```

Suggested GitHub Actions trigger (already in `.github/workflows/post-deploy.yml`):

- `push` of tags `v*`
- `workflow_dispatch` for a manual post-deploy run
- pull requests, so upgrades are verified before merge

Exit code is non-zero if any business journey fails. Treat **blocker** catalog cases as release-blocking.

## What is intentionally not here

Unit tests for VFS, planner, and ownership stay in `packages/*/tests`. This suite only covers end-user behavior that would fail a customer after they upgrade kiln.
