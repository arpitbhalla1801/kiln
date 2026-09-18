# Plugins

kiln 2.0.0 introduces a third-party capability plugin architecture. A plugin implements
the `Capability` interface from `@kiln/capability-sdk` and registers itself so
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

## Reference plugin

See the reference "hello world" plugin linked from
[CONTRIBUTING.md](https://github.com/arpitbhalla1801/kiln/blob/main/CONTRIBUTING.md)
for a full worked example: capability definition, `planAdd`, and lockfile round-trip.
