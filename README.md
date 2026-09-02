# kiln

Kiln is a capability-based project toolkit for Bun-compatible Next.js apps. It scaffolds projects, adds capabilities (env, auth), and tracks ownership of generated files.

## Requirements

- [Bun](https://bun.sh) 1.3+

## Quick start (from git clone)

```bash
git clone https://github.com/arpitbhalla1801/kiln.git
cd kiln
bun install
bun run build
bun test
```

### Use the CLI locally

Link the CLI from the monorepo so `kiln` is available in your shell:

```bash
bun run link-cli
kiln --help
```

### Create a new project

```bash
mkdir ~/projects && cd ~/projects
kiln create my-app
cd my-app
bun install
kiln add env
kiln add auth
bun run build
```

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
| `kiln create [name]` | Scaffold a new Next.js + TypeScript project |
| `kiln add env` | Add environment variable capability |
| `kiln add auth` | Add auth capability (next-auth) |
| `kiln inspect` | Inspect project metadata and ownership |
| `kiln doctor` | Run environment and project health checks |

Global flags: `--dry-run`, `--help`, `--version`

## Monorepo scripts

| Script | Description |
|--------|-------------|
| `bun run build` | Build all packages |
| `bun test` | Run all tests |
| `bun run link-cli` | Link `@kiln/cli` globally via `bun link` |
| `bun run lint` | Lint all packages |
| `bun run format` | Format all packages |

## Project structure

```
apps/cli              # kiln CLI
packages/core         # Shared types, ownership, validation
packages/runtime      # Capability execution runtime
packages/transform-engine  # Virtual filesystem and transforms
packages/capabilities/     # env, auth capabilities
examples/nextjs-app   # Reference app with env + auth applied
```

## Troubleshooting

**Build fails with missing `.d.ts` files** — run `bun run build` again (builds use `tsc -b --force`).

**`kiln: command not found`** — run `bun run link-cli` from the repo root.

**Doctor reports package-json-health failures** — your `package.json` may be missing required scripts or dependencies for a Next.js project.
