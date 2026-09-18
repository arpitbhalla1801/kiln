# Changelog

## 1.1.0

Real auth provider support, safer `--var` handling, and a bunch of CLI polish.

### Highlights

- Auth provider registry: `--provider github|google|credentials` scaffolds real imports, provider entries, and derived env vars in `auth.ts`
- Re-running `kiln add auth` with a new `--provider` merges into the existing `auth.ts` instead of overwriting it
- Real random `AUTH_SECRET` generated instead of a placeholder
- Route handler scaffolding when a provider is selected
- `--var` now works for `kiln add auth`, not just `env`
- `.env.local` seeded from `.env.example`, vars grouped under per-capability section headers, `required` flag honored
- `kiln remove <capability>` deletes what that capability owns
- `.kiln/lock.json` generated on every apply; `--dry-run` shows real content diffs, not just file paths
- Update notifier: tells you when a newer `@kiln-cli/kiln` is available

### Also included

- Dependency vulnerability fixes; `--var` keys/values reject embedded newlines (env injection)
- `SECURITY.md`, `CONTRIBUTING.md`, and issue/PR templates
- LICENSE shipped in the published package; `engines` declared
- CI post-deploy smoke suite runs on Linux, macOS, and Windows

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
