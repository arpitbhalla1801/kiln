---
title: Db capability
description: Scaffold Prisma into your project with kiln, including auth adapter wiring.
---

# Db capability

```bash
kiln add db
```

Scaffolds Prisma into the project: `prisma/schema.prisma`, a `src/lib/db.ts` client
singleton, `DATABASE_URL` in `.env.example`/`.env.local`, and `db`/`db:migrate` scripts
in `package.json`.

## Auth adapter wiring

If `auth` is already installed, adding `db` rewrites `src/auth.ts` to wire in
`PrismaAdapter(db)` and adds the `User`/`Account`/`Session`/`VerificationToken` models
auth.js's adapter needs to `schema.prisma`. This also works the other way around:
`kiln add auth` after `kiln add db` picks up the same wiring. Add order doesn't matter.

This rewrite only happens if `auth.ts` is still kiln's unedited output — a hand-edited
`auth.ts` is left alone.

## Migrations

```bash
kiln db migrate
kiln db migrate -- --name add-users
```

Runs `prisma migrate dev` with `.env.local` loaded into the environment, so
`DATABASE_URL` doesn't need to be exported manually first.

## Removing

`kiln remove db` deletes the files and dependencies `db` owns, but never touches
`prisma/migrations` or the database itself — those are left in place. If `auth` is
installed and wired to the adapter, removing `db` also unwires `auth.ts` back to its
no-adapter form.
