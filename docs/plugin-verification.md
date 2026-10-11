# Plugin verification

kiln loads a third-party plugin only if a maintainer reviewed that exact
release, or you pass `--allow-unverified`. This page is the process behind
"reviewed".

## What a reviewer checks

Review the published package contents, not the repository.

| Area | Question |
|---|---|
| Entry module | Does importing it do anything besides export the capability? Importing runs top-level code. |
| `planAdd` | Does it only build a plan? It must not write files, run commands, or touch the network. |
| Transforms | Are file, dependency, script and env-var changes what the manifest and README say? |
| Ownership | Does it claim everything it creates, so `kiln remove` takes it back? |
| Secrets | Do `--var` values stay out of `.env.example` and out of any committed file? |
| Dependencies | Does it add packages it needs, and only those? Does the package itself have install scripts? |
| Manifest | Are `description`, `providers`, `config`, `operations` and `verify` accurate? `verify` commands are shown to agents and may be run by `kiln doctor`, so each must be safe to run. |

## Requesting a review

Open an issue with the package name, exact version, and the manifest hash:

```bash
kiln capabilities show <id> --allow-unverified
# Manifest sha256: <64 hex characters>
```

## Recording a result

After review, a maintainer adds one entry to `VERIFIED_PLUGINS` in
`packages/runtime/src/plugin-verification.ts`:

```ts
{ package: 'kiln-capability-chat', version: '1.2.0', manifestSha256: '<hash>' }
```

The entry is bound to the package, the exact version, and the manifest hash.
It ships with the next kiln release; until then users pass
`--allow-unverified`.

## What invalidates a review

- **New version:** a new release is a new entry. Re-review the diff.
- **Changed manifest:** the hash changes, so the plugin is refused again,
  even at the same version.

## What verification does not give you

Verified means a maintainer read that release. It is not isolation: a loaded
plugin runs with full access to the project and the process. Isolation is
tracked in #238.
