# Getting Started

kiln is a capability-based CLI that scaffolds Bun-compatible Next.js projects and adds
capabilities (`env`, `auth`, and third-party plugins) on top of them, tracking ownership
of every generated file.

## Requirements

- [Bun](https://bun.sh) 1.3+

## Create a new project

```bash
kiln create my-app
cd my-app
bun install
kiln add env
kiln add auth
bun run build
```

Project names must be npm-safe: lowercase letters, numbers, hyphens, or underscores
(e.g. `my-app`).

Next: [Installation](/guide/installation) · [Commands](/guide/commands)
