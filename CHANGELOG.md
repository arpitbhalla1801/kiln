# Changelog

## 1.0.3

### Fixes

- Resolved dependency vulnerabilities, fixed a stale link-cli filter
- Bumped a Windows CI timeout that was flaking on `cli.test.ts`

### Added

- `kiln remove <capability>` to uninstall a capability and its tracked files/deps/scripts/env vars
- `.kiln/lock.json` generated on every capability apply
- `--dry-run` now shows real content diffs instead of just file paths
- Update notifier: `kiln` checks for a newer version and lets you know
- `SECURITY.md` with private vulnerability reporting enabled
- `CONTRIBUTING.md` and issue/PR templates

## 1.0.0

First usable release for git-clone users.

### Highlights

- `kiln create <name>` scaffolds a buildable Next.js 15 App Router project
- `kiln add env` / `kiln add auth` merge into existing files and track ownership
- `kiln inspect` and `kiln doctor` for project health
- Post-deploy upgrade suite: `bun run test:post-deploy`

### Fixes included

- Package.json / `.env.example` merge via VFS disk seeding
- `--var KEY=value` CLI parsing
- Idempotent re-add reports `no changes`
- `kiln create` refuses empty names, invalid names, and non-empty target directories
- Forced TypeScript builds (`tsc -b --force`)
