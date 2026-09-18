# kiln

A CLI for scaffolding Next.js + TypeScript projects and adding auth (NextAuth / Auth.js, with GitHub, Google, and Credentials providers) and environment-variable management. `kiln create` scaffolds a project; `kiln add <capability>` layers in a feature (`env`, `auth`) with ownership-tracked, idempotent file generation, so capabilities never silently clobber each other's changes on repeat runs.

## Requirements

- [Bun](https://bun.sh) 1.3+ (kiln shells out to Bun to install dependencies)

## Install

```bash
npm install -g @kiln-cli/kiln
```

Or run it without installing:

```bash
npx @kiln-cli/kiln create my-app
```

## Quick start

```bash
kiln create my-app
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
| `kiln create <name>` | Scaffold a new Next.js + TypeScript project |
| `kiln add env [--var KEY=value]` | Add environment variable capability |
| `kiln add auth [--provider github\|google\|credentials] [--var KEY=value]` | Add auth capability ([NextAuth / Auth.js](https://authjs.dev)) with a real provider |
| `kiln remove <env\|auth>` | Remove a capability: deletes its owned files, dependencies, scripts, and env vars |
| `kiln inspect` | Inspect project metadata and ownership |
| `kiln doctor` | Run environment and project health checks |

Global flags: `--dry-run`, `--help`, `--version`

## Troubleshooting

**`Target directory already exists`** — choose a new project name; `kiln create` will not overwrite non-empty directories.

**Doctor reports `package-json-health` failures** — your `package.json` may be missing required scripts or dependencies for a Next.js project.

**`Dependency install failed`** — make sure Bun is installed and on your `PATH`; `kiln add` uses it to install packages like `next-auth`.

## Links

- [Source & issues](https://github.com/arpitbhalla1801/kiln)
- License: MIT
