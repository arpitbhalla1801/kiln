# kiln

**Create your app once. Compose capabilities over time.**

Capability-based CLI for Next.js apps. Add `auth`, `db`, `env` with one command, remove them just as cleanly. Kiln tracks every file, dependency, script and env var it adds, so `kiln remove` never touches yours.

## Install

```bash
npm install -g @kiln-cli/kiln    # or pnpm / yarn / bun
# or: npx @kiln-cli/kiln init my-app
```

## Use

```bash
kiln init my-app && cd my-app && bun install
kiln add auth --provider github
kiln add db
kiln remove auth
```

Adopt an existing app with `kiln init --existing`. Preview any change with `--dry-run`. Works with bun, pnpm, npm and yarn.

Full docs, plugin guide and architecture: [github.com/arpitbhalla1801/kiln](https://github.com/arpitbhalla1801/kiln#readme)

MIT
