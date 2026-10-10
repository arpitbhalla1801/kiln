---
title: Commands
description: Full list of kiln CLI commands, covering init, add, plugins, and more.
---

# Commands

| Command | Description |
|---------|-------------|
| `kiln init <name>` | Scaffold a new Next.js + TypeScript project |
| `kiln init --existing` | Adopt an existing Next.js project in place, without overwriting it |
| `kiln add env [--var KEY=value]` | Add environment variable capability |
| `kiln add auth [--provider <name>] [--var KEY=value]` | Add auth capability (next-auth) |
| `kiln add db` | Add db capability (Prisma). Auto-wires `auth`'s adapter if `auth` is already installed |
| `kiln add <capability>` | Add any registered capability, including third-party plugins |
| `kiln plan add <capability> [--json]` | Preview an add — files, dependencies, ownership changes — without writing anything |
| `kiln remove <capability> [--force]` | Remove a capability's files, dependencies, scripts, and env vars |
| `kiln undo [--dry-run]` | Revert the files changed by the last add, remove, or env remove |
| `kiln env remove <NAME> [<NAME>...]` | Remove specific variables from `.env.local` and `.env.example` |
| `kiln db migrate [-- <prisma args>]` | Run `prisma migrate dev` with `.env.local` loaded |
| `kiln inspect [--verbose]` | Inspect project metadata and ownership |
| `kiln doctor` | Run environment and project health checks |
| `kiln init-plugin <name>` | Scaffold a new third-party capability plugin package |
| `kiln plugins list` | List installed plugin capabilities |
| `kiln plugins verify` | Verify installed plugin version pins |

Global flags: `--dry-run`, `--help`, `--version`

Every command also takes `--help` for its full usage, including flags not listed
above (e.g. `kiln remove --help`).

See [Capabilities](/capabilities/overview) for what each capability scaffolds, and
[Plugins](/capabilities/plugins) for writing your own.
