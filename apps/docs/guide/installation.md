# Installation

## From npm

```bash
npm install -g @kiln-cli/kiln
```

## From source

```bash
git clone https://github.com/arpitbhalla1801/kiln.git
cd kiln
bun install
bun run build
bun run test:unit
bun run link-cli
```

`bun run link-cli` builds the CLI package and links it globally via `bun link`.

## Try the example app

```bash
cd examples/nextjs-app
bun install
bun run build
bun run dev
```

Open http://localhost:3000.
