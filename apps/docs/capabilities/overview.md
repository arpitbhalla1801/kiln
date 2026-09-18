# Capabilities overview

A capability is a self-contained unit of scaffolding kiln can add to a project: files it
writes, dependencies it installs, and env vars it declares. Built-in capabilities are
`env` and `auth`. Third-party capabilities register through the plugin architecture
(`@kiln/capability-sdk`) and are added the same way: `kiln add <capability>`.

- [Auth](/capabilities/auth)
- [Env](/capabilities/env)
- [Plugins](/capabilities/plugins)
