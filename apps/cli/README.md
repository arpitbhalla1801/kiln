# kiln

Capability-based scaffolding CLI for Node/Next.js projects. `kiln init` scaffolds a project; `kiln add <capability>` layers in features (`env`, `auth`) while tracking which capability owns which file, dependency, script, and env var so capabilities never silently clobber each other's changes.

## Requirements

- [Bun](https://bun.sh) 1.3+ (kiln shells out to Bun to install dependencies)

## Install

```bash
npm install -g @kiln-cli/kiln
```

Or run it without installing:

```bash
npx @kiln-cli/kiln init my-app
```

## Quick start

```bash
kiln init my-app
cd my-app
bun install
kiln add env
kiln add auth
bun run build
```

Project names must be npm-safe: lowercase letters, numbers, hyphens, or underscores (e.g. `my-app`).

## Commands

| Command | Description |
|---------|-------------|
| `kiln init <name>` | Scaffold a new Next.js + TypeScript project |
| `kiln add env [--var KEY=value]` | Add environment variable capability |
| `kiln add auth` | Add auth capability ([next-auth](https://authjs.dev)) |
| `kiln remove <env\|auth>` | Remove a capability: deletes its owned files, dependencies, scripts, and env vars |
| `kiln inspect` | Inspect project metadata and ownership |
| `kiln doctor` | Run environment and project health checks |

Global flags: `--dry-run`, `--help`, `--version`

## Troubleshooting

**`Target directory already exists`** — choose a new project name; `kiln init` will not overwrite non-empty directories.

**Doctor reports `package-json-health` failures** — your `package.json` may be missing required scripts or dependencies for a Next.js project.

**`Dependency install failed`** — make sure Bun is installed and on your `PATH`; `kiln add` uses it to install packages like `next-auth`.

## Links

- [Source & issues](https://github.com/arpitbhalla1801/kiln)
- License: MIT
