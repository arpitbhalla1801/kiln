# Kiln Next.js Example

Reference app showing the kiln MVP flow on a Bun-compatible Next.js project.

## What's included

This example mirrors the output of:

```bash
kiln init kiln-nextjs-example
bun install
kiln add env
kiln add auth
```

- **Env capability** — `.env.example` with `AUTH_SECRET` and `DATABASE_URL`
- **Auth capability** — `next-auth`, `src/auth.ts`, `src/middleware.ts`
- **Ownership** — `.kiln/ownership.json` tracking capability ownership

## Requirements

- [Bun](https://bun.sh) 1.3+

## Run locally

```bash
cd examples/nextjs-app
bun install
bun run dev
```

Open http://localhost:3000

## Verify build

```bash
bun run build
bun run typecheck
```

## Inspect with kiln

From this directory:

```bash
kiln inspect
kiln doctor
```
