# Writing a kiln capability plugin

A plugin is an npm package that implements the `Capability` interface from
`@kiln/capability-sdk`. `kiln add <id>` runs its `planAdd`, applies the
transforms it returns, and records what it owns. `kiln remove <id>` takes that
back. For the design and trust model, see
[plugin-architecture.md](plugin-architecture.md).

## Start

```bash
kiln init-plugin chat
cd kiln-capability-chat
bun install
bun run build
bun test
```

The scaffold is a working capability, not a stub. `kiln add chat`:

- creates `src/lib/chat.ts`
- adds the `zod` dependency and a `chat:check` script
- adds `CHAT_API_KEY` to `.env.example` as a placeholder, and to `.env.local` with the `--var` value
- adds `.env.local` to `.gitignore`

`kiln remove chat` undoes all of it except the `.gitignore` line. Replace
the file, dependency, script and variable with what your capability needs.

| File | What it holds |
|---|---|
| `src/capability.ts` | `Capability` implementation, `planAdd` |
| `src/types.ts` | ids, paths, deps, scripts, the options type |
| `src/templates.ts` | content of generated files |
| `src/validation.ts` | ownership claims |
| `src/manifest-data.ts`, `kiln.manifest.json` | id, version, declared ownership |
| `src/index.ts` | default export kiln loads |

## The contract

```ts
interface Capability {
  readonly id: string;
  getManifest(): Promise<CapabilityManifest>;
  getCapability(): Promise<ResolvedCapability>;
  planAdd(rootPath: string, options: CapabilityPlanOptions): Promise<CapabilityPlan>;
}

interface CapabilityPlan {
  transforms: TypedTransform[];
  capability: ResolvedCapability;
  ownershipRegistrations: OwnershipRegistration[];
}
```

The file named by the package's `main` field must default-export an
instance, or export it under the name `capability`. `planAdd` only plans. It
must not write files, because kiln also runs it for `--dry-run` and
`kiln plan`. Read the project through `rootPath` when the plan depends on
what is already there.

Full types: `node_modules/@kiln/capability-sdk/dist/index.d.ts`.

## Transforms

A plugin composes these six kinds. It can't register new kinds.

| `type` | Fields | Use |
|---|---|---|
| `file-create` | `filePath`, `content` | New file. Overwrites if the file exists, so check `rootPath` first. |
| `file-patch` | `filePath`, `search`, `replace` | Edit an existing file. No-op if `replace` is already present. Fails if neither `search` nor `replace` is found. |
| `file-delete` | `filePath` | Delete a file. |
| `json-mutation` | `filePath`, `path`, `value`, `operation: 'set' \| 'delete'` | Edit a JSON file other than `package.json`. |
| `package-json-mutation` | `dependencies`, `devDependencies`, `scripts`, `remove*` | Deps are installed after apply. Existing key order is kept. |
| `env-mutation` | `filePath`, `variables`, `section`, `preserveExistingValues`, `removeVariables` | Add or remove env vars. Each `variables` value is a string or `{ value, example, required }`. |

Every transform also needs a unique `id`.

## Ownership and remove

`ownershipRegistrations` is what kiln records in `.kiln/ownership.json`. Two
capabilities can't claim the same resource. `kiln remove <id>` then:

- deletes owned files, but keeps a file the user edited and warns about it
- removes owned dependencies and scripts from `package.json`
- removes owned env vars from `.env.example` and `.env.local`
- refuses, unless `--force` is passed, when remaining code still imports a file or dependency it would remove

Anything you don't claim stays after remove. In particular, `file-patch`
edits to files you don't own are not reverted. Plugins have no `planRemove`
hook, so design your patches so the leftover is harmless, or tell users to
revert them by hand.

Resource types: `file`, `dependency`, `script`, `envVar`, `metadata`.

## Options

`planAdd` receives the CLI options plus what kiln computes:

- `variables`: `--var KEY=VALUE` pairs
- `providers`: `--provider` values
- `envExamplePath`: where the project keeps its example env file
- `tracker`: the current ownership state

Extend `CapabilityPlanOptions` in `types.ts` for the fields you read. See
`ChatCapabilityPlanOptions` in the scaffold.

## Rules

- **Secrets:** never put a `--var` value in `.env.example`, because it is committed. Put a placeholder there and the value in `.env.local`, and make sure `.gitignore` covers `.env.local`. The scaffold does all three.
- **Re-running:** `kiln add` can run again on the same project. Skip `file-create` when the file already exists, and use `preserveExistingValues: true` on env vars.
- **Databases:** there is no migration transform. Ship schema as your own files and tell users to run `kiln db migrate`. Don't `file-patch` a schema the `db` capability owns.

## Testing

- **Unit:** call `planAdd` on a temp dir and assert on transforms and ownership. The scaffold's `tests/capability.test.ts` does this, including the secret rule and re-running.
- **End to end:** install the built plugin in a scratch Next.js app (see below), then run `kiln add <id> --dry-run`, `kiln add <id>`, `kiln inspect` and `kiln remove <id>`.

## Distribution

kiln loads a plugin only if all of these hold:

1. it is a **direct** dependency in the project's own `package.json`
2. `kiln.plugins.json` pins its **exact** installed version: `{ "plugins": [{ "package": "kiln-capability-chat", "version": "0.1.0" }] }`
3. its `package.json` depends on `@kiln/capability-sdk` with the same major version as kiln's

A plugin that fails any check is skipped with a message. `kiln plugins verify`
checks the pins without running plugin code.

| Source | In the project |
|---|---|
| npm | `npm install kiln-capability-chat@0.1.0` |
| private registry | same, after configuring the registry in the project's `.npmrc` |
| local path, for development | `npm install ../kiln-capability-chat`. This links it, so run `bun run build` in the plugin to pick up changes. |
| git or monorepo workspace | any spec your package manager supports, as long as the installed version matches the pin |

- **Upgrading:** release a new version, install it, and bump the pin in `kiln.plugins.json`.
- **Revoking:** delete the entry from `kiln.plugins.json`. kiln stops loading the plugin even while it is still installed. Run `kiln remove <id>` first to undo what it added.

## Trust

A plugin is ordinary code running with your user's permissions during
`kiln add`, `plan` and `remove`. kiln doesn't sandbox it. The trust checks are
the direct dependency, the exact pin and the SDK major. Ownership conflicts
stop a plugin from taking over another capability's files. Review a plugin's
source before pinning it, the same as any dependency. Details are in
[SECURITY.md](../SECURITY.md) and
[plugin-architecture.md](plugin-architecture.md).
