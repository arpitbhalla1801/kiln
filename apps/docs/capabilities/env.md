# Env capability

```bash
kiln add env
kiln add env --var API_URL=https://example.com
```

Scaffolds `.env.local` seeded from `.env.example`. Vars in `.env.example` are grouped
under per-capability section headers, so running `kiln add auth` after `kiln add env`
appends its vars under an `# auth` section rather than flattening everything together.
`--var KEY=value` seeds or overrides a value directly.
