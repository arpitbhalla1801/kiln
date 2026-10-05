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
