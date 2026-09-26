# Changelog

## 2.0.0

### Breaking

- `kiln create` is replaced by `kiln init`

### Features

- `kiln init --existing` retrofits kiln onto an existing app
- `kiln remove` refuses to clobber edited files, warns about broken imports, keeps shared env values, and reverts the gitignore line, empty env sections and empty directories
- `kiln add` warns when it skips a kiln-owned file you edited
- `kiln add auth` and `kiln add db` refuse projects without TypeScript
- Installs work with npm, pnpm, yarn and bun

### Fixes

- Adding `env` or `db` keeps existing `.env.example` values, Prisma versions and db scripts
- Capabilities claim only what kiln adds, so `remove` leaves user files alone
- `package.json` key order and indentation are preserved
- Ownership conflict errors name the attempted owner

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
