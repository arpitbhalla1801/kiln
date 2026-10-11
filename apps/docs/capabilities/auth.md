---
title: Auth capability
description: Scaffold next-auth into your project with kiln, including provider config and env vars.
---

# Auth capability

```bash
kiln add auth
kiln add auth --provider github --var GITHUB_ID=xxx --var GITHUB_SECRET=yyy
```

Scaffolds next-auth into the project: config, API route, and provider setup.
`--provider` selects the auth provider; `--var` overrides or seeds env vars for it,
same flag semantics as `kiln add env`.

Standalone, `auth` uses JWT sessions — no database required. If [`db`](/capabilities/db)
is also installed (in either order), `auth` automatically wires a Prisma adapter into
`src/auth.ts` instead, switching to database-backed sessions. See the db capability
page for what that rewrite does and how removal unwinds it.
