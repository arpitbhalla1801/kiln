---
title: Db capability
description: Scaffold Prisma with a PostgreSQL schema, client and scripts into your project with kiln.
---

# Db capability

```bash
kiln add db
kiln db migrate
```

Scaffolds Prisma for PostgreSQL:

- `prisma/schema.prisma` with a starter `User` model
- `lib/db.ts` (or `src/lib/db.ts`) exporting a shared `PrismaClient`
- `@prisma/client` and `prisma` dependencies
- `db:generate`, `db:migrate` and `db:studio` scripts
- a `DATABASE_URL` env var, added through the [env capability](/capabilities/env)

`kiln db migrate` runs `prisma migrate dev` with `.env.local` loaded.

## With auth

Adding `auth` and `db` together, in either order, wires the Auth.js Prisma adapter:
`Account`, `Session` and `VerificationToken` models, `User` relations, and
`adapter: PrismaAdapter(db)` in `auth.ts`. This switches NextAuth's default session
strategy from `jwt` to `database`.

## Remove

`kiln remove db` removes what kiln added. It never touches `prisma/migrations` or your database.
