---
layout: home

hero:
  name: kiln
  text: Capability-based CLI for Bun + Next.js
  tagline: Scaffold projects, add auth/env/plugin capabilities, and track ownership of generated files.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/arpitbhalla1801/kiln
    - theme: alt
      text: npm
      link: https://www.npmjs.com/package/@kiln-cli/kiln

features:
  - title: Auth capability
    details: Add next-auth with provider selection and --var overrides in one command.
  - title: Env capability
    details: Scaffold .env.local from .env.example, grouped by capability.
  - title: Plugin architecture
    details: Extend kiln with third-party capabilities via the @kiln/capability-sdk.
---

## What kiln does

kiln is a capability-based CLI for Bun and Next.js projects. Instead of hand-wiring auth, environment variables, and plugins into every new app, kiln scaffolds each capability with a single command and tracks which files it generated so upgrades stay predictable.

A capability-based CLI means each feature — auth, env, plugins — is an isolated, composable unit you opt into. Run `kiln add auth` to wire up next-auth with a provider of your choice, `kiln add env` to generate a `.env.local` from your `.env.example`, or `kiln init-plugin` to scaffold a third-party capability using the `@kiln/capability-sdk`. Built for Bun and Next.js, kiln keeps generated code idiomatic to both.

## Install

```bash
git clone https://github.com/arpitbhalla1801/kiln.git
cd kiln
bun install && bun run build && bun run link-cli
```

## Links

- [Getting Started](/guide/getting-started)
- [CLI Reference](/reference/cli)
- [Changelog](https://github.com/arpitbhalla1801/kiln/blob/main/CHANGELOG.md)
- [Contributing](https://github.com/arpitbhalla1801/kiln/blob/main/CONTRIBUTING.md)
