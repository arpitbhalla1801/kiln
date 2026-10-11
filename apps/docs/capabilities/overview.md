---
title: Capabilities overview
description: What a kiln capability is, built-in capabilities, and how third-party plugins register.
---

# Capabilities overview

A capability is a self-contained unit of scaffolding kiln can add to a project: files it
writes, dependencies it installs, and env vars it declares. Built-in capabilities are
`env`, `auth`, and `db`. Third-party capabilities register through the plugin architecture
(`@kiln-cli/capability-sdk`) and are added the same way: `kiln add <capability>`.

Capabilities can adapt to each other: adding `db` after `auth` (or `auth` after `db`)
wires Prisma's adapter into the generated auth config automatically, regardless of
which order you add them in. See [Auth](/capabilities/auth) and [Db](/capabilities/db)
for the specifics.

- [Auth](/capabilities/auth)
- [Env](/capabilities/env)
- [Db](/capabilities/db)
- [Plugins](/capabilities/plugins)
