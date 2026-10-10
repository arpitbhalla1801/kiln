---
title: Env capability
description: Scaffold .env.local from .env.example with kiln, grouped by capability section.
---

# Env capability

```bash
kiln add env
kiln add env --var API_URL=https://example.com
```

Scaffolds `.env.local` seeded from `.env.example`. Vars in `.env.example` are grouped
under per-capability section headers, so running `kiln add auth` after `kiln add env`
appends its vars under an `# auth` section rather than flattening everything together.
`--var KEY=value` seeds or overrides a value directly.

## Removing individual variables

```bash
kiln env remove API_URL
kiln env remove API_URL ANOTHER_KEY
```

`kiln env remove <NAME>...` removes specific variables from `.env.local` and
`.env.example` without removing the whole capability that owns them. This is a
separate command from `kiln add env`/`kiln remove env`, which operate on the `env`
capability as a whole.
