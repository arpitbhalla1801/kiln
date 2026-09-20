# Changelog

## 1.2.0

### Fixes

- `kiln add auth` reconciles the provider set on re-add instead of only adding new providers
- `kiln add env` gains `kiln env remove` and stops leaking removed vars back into `.env.local`
- `.env.example` never receives real secret values, only placeholders
- `kiln add auth` repairs a missing `AUTH_SECRET` on re-add instead of no-op

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
