---
title: Logging capability
description: Capture client and server errors in a Next.js project with Sentry, using kiln.
---

# Logging capability

```bash
kiln add env
kiln add logging --provider sentry --var SENTRY_DSN=... --var NEXT_PUBLIC_SENTRY_DSN=...
```

Needs `env` installed first. Adds:

- `src/lib/logger.ts`, a wrapper with `captureException` and `captureMessage`. It is the only file that imports the provider, so switching providers means rewriting this one file.
- `src/app/global-error.tsx`, which reports render errors.
- `src/instrumentation.ts` for server and request errors, and `src/instrumentation-client.ts` for client errors. The client file needs Next.js 15.3 or later.
- `@sentry/nextjs` in `package.json`.
- `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in `.env.example` (placeholders) and `.env.local` (values from `--var`).

Files go under `src/` when the project has `src/app`, otherwise at the project root.
Sentry stays off until a DSN is set.

## Existing files

A file you already have, such as your own `instrumentation.ts`, is left alone and not
claimed. Wire Sentry into it by hand. Re-running `kiln add logging` keeps files kiln
wrote, including ones you edited.

## Removing

`kiln remove logging` deletes the files, dependency and env vars it added. A file you
edited since kiln wrote it is kept, with a warning.
