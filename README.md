# kiln

**Create your app once. Compose capabilities over time.**

[![npm](https://img.shields.io/npm/v/@kiln-cli/kiln?color=cb3837)](https://www.npmjs.com/package/@kiln-cli/kiln)
[![downloads](https://img.shields.io/npm/dm/@kiln-cli/kiln)](https://www.npmjs.com/package/@kiln-cli/kiln)
[![CI](https://github.com/arpitbhalla1801/kiln/actions/workflows/post-deploy.yml/badge.svg)](https://github.com/arpitbhalla1801/kiln/actions/workflows/post-deploy.yml)
[![license](https://img.shields.io/npm/l/@kiln-cli/kiln)](LICENSE)
[![node](https://img.shields.io/node/v/@kiln-cli/kiln)](https://nodejs.org)

Most scaffolders run once and walk away. Kiln stays. Start a Next.js app, then add `auth`, `db`, `env` as it grows. Kiln tracks every file, dependency, script and env var it adds, so `kiln remove` undoes exactly that and nothing of yours.

- **Add** in one command. Preview with `--dry-run`.
- **Remove** cleanly. Kiln only deletes what it owns.
- **Adopt** an existing Next.js app without clobbering a file.
- **Extend** with your own capability plugins.
- Works with **bun, pnpm, npm, yarn**.

## Demo

```bash
kiln init my-app && cd my-app && bun install
kiln add auth --provider github
```

```diff
+ src/auth.ts            # next-auth config
+ src/middleware.ts      # route protection

  package.json
+   "next-auth": "^5.0.0-beta.32"

  .env.example
+ AUTH_SECRET=replace-me
+ AUTH_GITHUB_ID=
+ AUTH_GITHUB_SECRET=
```

Everything is recorded in `.kiln/ownership.json`. `kiln remove auth` deletes only that.

## Install

```bash
npm install -g @kiln-cli/kiln    # or pnpm / yarn / bun
# or run once: npx @kiln-cli/kiln init my-app
```

Kiln detects your package manager from `packageManager` or the lockfile and uses it. `kiln init` scaffolds with bun; existing projects keep theirs.

## Create

```bash
kiln init my-app          # new Next.js + TypeScript project
kiln init --existing      # adopt the project in the current directory
```

`--existing` marks every file already on disk as external, so `kiln add` never overwrites it and `kiln remove` never deletes it.

## Capabilities

| Command | Adds |
|---------|------|
| `kiln add env [--var KEY=value]` | Env vars in `.env.local` and `.env.example` |
| `kiln add auth [--provider github\|google\|credentials]` | next-auth, middleware, provider env vars |
| `kiln add db` | Prisma schema, client and scripts (PostgreSQL) |
| `kiln remove <capability>` | Everything kiln added for it, and only that |

`remove` keeps files you edited, refuses while your code still imports what it would delete (`--force` overrides), and never touches `prisma/migrations` or your database.

## Other commands

| Command | Does |
|---------|------|
| `kiln env remove <NAME>...` | Drop single env vars |
| `kiln db migrate` | `prisma migrate dev` with `.env.local` loaded |
| `kiln inspect` | Project, capabilities, managed files, last operation, health (`--verbose` lists ownership) |
| `kiln doctor` | Health checks |

Global flags: `--dry-run`, `--help`, `--version`.

## Write your own capability

```bash
kiln init-plugin hello-world    # scaffolds kiln-capability-hello-world
kiln plugins list               # entries in kiln.plugins.json and whether they load
kiln plugins verify             # version-pin mismatches
```

Plugins are opt-in via `kiln.plugins.json`. Guides: [writing a plugin](docs/writing-a-plugin.md), [plugin architecture](docs/plugin-architecture.md).

## Architecture

The planner checks ownership conflicts, the transform engine applies changes on a virtual filesystem, and files are written only if the plan is clean.

```
apps/cli                packages/planner         packages/capabilities/{env,auth,db}
packages/core           packages/runtime         packages/sdk
packages/project-model  packages/transform-engine  packages/adapters/node
```

## Development

```bash
git clone https://github.com/arpitbhalla1801/kiln.git && cd kiln
bun install && bun run build && bun run test:unit && bun run link-cli
```

Needs Bun 1.3+. Try `examples/nextjs-app`. Smoke suite: [tests/post-deploy](tests/post-deploy/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
