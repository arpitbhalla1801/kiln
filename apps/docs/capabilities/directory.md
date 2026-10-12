---
title: Capability directory
description: Directory of kiln capabilities you can add to your project, built-in and community plugins.
---

# Capability directory

Capabilities you can add with `kiln add <id>`.

## Built-in

| Capability | Id | What it does |
| --- | --- | --- |
| [Env](/capabilities/env) | `env` | Manages `.env.example` and env vars. |
| [Auth](/capabilities/auth) | `auth` | Scaffolds next-auth with provider config. |
| [Db](/capabilities/db) | `db` | Scaffolds Prisma with schema, client and scripts. Needs `env`. |

## Community plugins

None listed yet.

::: warning
Plugins run with full write access to your project and are not sandboxed.
Listed plugins are community-maintained and not audited. Read the code before
you pin one in `kiln.plugins.json`.
:::

## List your plugin

Open a PR adding a row to the community table. It should:

- be published on npm with a public repo
- pass `kiln plugins verify`
- document its options and env vars
- clean up fully with `kiln remove`

See [Plugins](/capabilities/plugins) for how to build one.
