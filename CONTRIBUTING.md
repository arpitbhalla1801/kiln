# Contributing to kiln

Thanks for considering a contribution. This is a Bun-based monorepo (Turborepo + TypeScript project references).

## Setup

```bash
git clone https://github.com/arpitbhalla1801/kiln.git
cd kiln
bun install
bun run build
```

## Running tests

```bash
bun run test:unit         # unit tests across apps/ and packages/
bun run test:post-deploy  # end-to-end CLI smoke tests (run after bun run build)
```

Both suites run in CI (`.github/workflows/post-deploy.yml`) on Linux, macOS, and Windows for every PR — please make sure they pass locally first.

## Trying your changes as the real CLI

```bash
bun run link-cli   # builds @kiln-cli/kiln and bun links it globally
kiln init test-app
```

## Repo layout

```
apps/cli                   # the published kiln CLI (@kiln-cli/kiln)
packages/core               # shared types, ownership tracking, validation, lifecycle
packages/planner             # dependency graph + execution planning
packages/transform-engine    # virtual filesystem, typed transforms, persistence, rollback
packages/project-model        # .kiln/ state (ownership.json, lockfile)
packages/adapters/node        # package-manager + Next.js detection
packages/capabilities/         # env, auth, db capabilities
packages/runtime               # wires lifecycle + planner + transform-engine together
examples/nextjs-app             # reference app with env + auth already applied
tests/post-deploy                # CLI smoke-test suite run against the built bin
docs/                          # architecture references that outlive any single issue/PR
```

See the root [README](README.md) for the CLI's own quick start.

## Architecture references

Some decisions are documented separately from the code because the *why*
matters as much as the *what*, and shouldn't have to be reconstructed from
git history:

- [docs/plugin-architecture.md](docs/plugin-architecture.md) — the
  third-party capability plugin system (milestone 2.0.0): what's decided,
  what's rejected and why, and how it maps to GitHub issues.
- [docs/writing-a-plugin.md](docs/writing-a-plugin.md) — a copy-pasteable
  "hello world" walkthrough for writing a third-party capability plugin,
  file by file.

## Making a change

1. Open an issue first for anything beyond a trivial fix — this project tracks its roadmap through GitHub issues with labels like `p0`/`p1`/`p2`, `security`, `capability`, `rfc`; a quick discussion before a PR avoids wasted work on the wrong approach.
2. Add or update tests for the behavior you're changing. A bug fix without a regression test is considered incomplete.
3. Run `bun run build`, `bun run test:unit`, and `bun run test:post-deploy` before opening a PR.
4. Keep PRs focused — one fix or feature per PR is much easier to review than a bundle of unrelated changes.

## Releasing `@kiln/capability-sdk`

`@kiln/capability-sdk` is independently versioned from `@kiln-cli/kiln` — a plugin author pins against the SDK's own major version, not kiln's. Any change to a type re-exported from `packages/sdk/src/index.ts` (see [packages/sdk/README.md](packages/sdk/README.md) for exactly which types that covers) requires an `@kiln/capability-sdk` major version bump, regardless of what `@kiln-cli/kiln`'s own version is doing at the time. Kiln's own version can bump freely without touching the SDK's; the two are unrelated release trains that happen to ship from the same repo.

## Commit style

This repo doesn't enforce a strict commit convention, but prefixing with a type (`fix:`, `feat:`, `docs:`, `ci:`) and referencing the issue it closes (`Fixes #123`) makes the history and release notes easier to follow.

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. For security vulnerabilities, see [SECURITY.md](SECURITY.md) instead of opening a public issue.
