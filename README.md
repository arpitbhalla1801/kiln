# kiln

**v1.0.0** — capability-based project toolkit for Bun-compatible Next.js apps.

Kiln scaffolds projects, adds capabilities (`env`, `auth`), and tracks ownership of generated files.

## Requirements

- [Bun](https://bun.sh) 1.3+

## Quick start (from git clone)

```bash
git clone https://github.com/arpitbhalla1801/kiln.git
cd kiln
git checkout v1.0.0   # or main after the v1 release merges
bun install
bun run build
bun run test:unit
bun run test:post-deploy
bun run link-cli
```

### Create a new project

```bash
kiln create my-app
cd my-app
bun install
kiln add env
kiln add auth
bun run build
```

Project names must be npm-safe: lowercase letters, numbers, hyphens, or underscores (e.g. `my-app`).

### Try the example app

```bash
cd examples/nextjs-app
bun install
bun run build
bun run dev
```

Open http://localhost:3000

## CLI commands

| Command | Description |
|---------|-------------|
| `kiln create <name>` | Scaffold a new Next.js + TypeScript project |
| `kiln add env [--var KEY=value]` | Add environment variable capability |
| `kiln add auth` | Add auth capability (next-auth) |
| `kiln inspect` | Inspect project metadata and ownership |
| `kiln doctor` | Run environment and project health checks |

Global flags: `--dry-run`, `--help`, `--version`

## Monorepo scripts

| Script | Description |
|--------|-------------|
| `bun run build` | Build all packages |
| `bun run test:unit` | Unit tests in `apps` and `packages` |
| `bun run test:post-deploy` | Version-upgrade smoke tests (after `bun run build`) |
| `bun run link-cli` | Link `@kiln/cli` globally via `bun link` |
| `bun run lint` | Lint all packages |
| `bun run format` | Format all packages |

## Version upgrade / post-deploy checks

After each kiln version is built, run the business-journey suite against the compiled CLI:

```bash
bun run build
bun run test:post-deploy
```

Catalog: [`tests/post-deploy/README.md`](tests/post-deploy/README.md). CI: `.github/workflows/post-deploy.yml` (PRs, `main`, tags `v*`, `workflow_dispatch`).

## Project structure

```
apps/cli                   # kiln CLI (@kiln/cli@1.0.0)
packages/core              # Shared types, ownership, validation
packages/runtime           # Capability execution runtime
packages/transform-engine  # Virtual filesystem and transforms
packages/capabilities/     # env, auth capabilities
examples/nextjs-app        # Reference app with env + auth applied
tests/post-deploy          # Upgrade smoke suite
```

## Troubleshooting

**Build fails with missing `.d.ts` files** — run `bun run build` again (builds use `tsc -b --force`).

**`kiln: command not found`** — run `bun run link-cli` from the repo root.

**`Target directory already exists`** — choose a new project name; `kiln create` will not overwrite non-empty directories.

**Doctor reports package-json-health failures** — your `package.json` may be missing required scripts or dependencies for a Next.js project.
