---
title: Plugins
description: Build and register third-party capability plugins for kiln using the capability SDK.
---

# Plugins

kiln 2.0.0 introduces a third-party capability plugin architecture. A plugin implements
the `Capability` interface from `@kiln-cli/capability-sdk` and registers itself so
`kiln add <capability>` can dispatch to it the same way it dispatches to built-in
`env`/`auth` capabilities.

## Scaffold a new plugin

```bash
kiln init-plugin my-plugin
```

Generates a starter plugin package implementing the `Capability` interface.

## Manage installed plugins

```bash
kiln plugins list      # list installed plugin capabilities
kiln plugins verify    # verify installed plugin version pins
```

kiln skips a plugin, without importing its code, unless a kiln maintainer
reviewed that exact release. Review the plugin, then pass `--allow-unverified`
to `add`, `remove`, `plan`, `inspect`, `plugins list` or `capabilities` to load
it. `kiln capabilities list` shows each plugin's trust status.

## Writing a plugin

[docs/writing-a-plugin.md](https://github.com/arpitbhalla1801/kiln/blob/main/docs/writing-a-plugin.md)
covers transforms, ownership and remove, options, testing, distribution and trust.
