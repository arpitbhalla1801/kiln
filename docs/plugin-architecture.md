# Third-party capability plugin architecture (v2.0.0)

This is the living technical reference for kiln's plugin system. It exists so
the reasoning behind each decision survives past whichever GitHub issue or
PR made it — update this file whenever an implementation detail changes,
not just the issue that shipped it.

Tracking: [milestone 2.0.0 - third-party plugin architecture](https://github.com/arpitbhalla1801/kiln/milestone/4)
(issues #97-#115).

## Why

Kiln ships three first-party capabilities (`env`, `auth`, `db`), each a
workspace package statically compiled into a single esbuild-bundled CLI.
There's no way today for anyone outside this repo to add a capability.
Issue #74 flagged this as a 2.0 blocker. This document is the design that
resolves it.

## Ground truth before this work started

Recorded here because it explains *why* several phases below exist — each
line is a real constraint found by reading the code, not an assumption.

- **No shared `Capability` interface exists.** `EnvCapability`,
  `AuthCapability`, `DbCapability` are three independently-written classes.
  `planAdd` signatures diverge: Env takes a positional `variables` arg,
  Auth/Db fold everything into an options bag. Return shapes partially
  diverge too (Auth/Db add `envPlan`/`paths`/`providers`).
- **Manifest `hooks`/`validations` fields are dead code.** Schema-validated,
  never executed. No dynamic `import()`/`require()` exists anywhere in
  `packages/core`, `packages/capabilities/*`, or `packages/transform-engine`
  before this work. Kiln has never had an extension-loading mechanism —
  everything in Phase 3 is genuinely new, not a fix to something half-built.
- **`OwnershipTracker`** (`packages/core/src/ownership.ts`) is the one
  genuinely generic, reusable piece of the current architecture —
  resource-type-driven (`file`/`dependency`/`script`/`envVar`/`metadata`),
  no capability-specific knowledge baked in. Every phase below leans on it
  rather than replacing it.
- **The transform system is a closed, exhaustive union.** Exactly six
  `TypedTransform` variants (`file-create`, `file-patch`, `file-delete`,
  `json-mutation`, `package-json-mutation`, `env-mutation`).
  `TransformApplier.apply()` is a `switch` with a `default: throw`. This
  stays closed — see "Rejected alternatives" below. (The manifest-level
  `TransformType` enum has a 7th value, `file-modify`, but it's a documented
  alias resolved into `file-create` by `resolveTypedTransform` — not a
  missing variant, just a different name at the manifest-declaration layer.
  See #98.)
- **Runtime dispatch is fully hardcoded.** `CAPABILITY_REGISTRY` was a
  literal object, `SupportedCapabilityId` a closed TS union,
  `CapabilityRuntime` had three named fields built from statically-imported
  classes, and `add.ts` dispatched via a hardcoded ternary.
- **`kiln remove` is already capability-agnostic.** It never imports a
  capability class — it works purely off `OwnershipTracker` snapshot records
  filtered by capability-id string. This is why the roadmap below has no
  "generalize remove" phase: removal was already free, addition was the
  hard part.
- **The CLI is a single esbuild-bundled file.** `apps/cli/dist/index.js`
  inlines every first-party capability package at kiln's own build time.
  Nothing is dynamically loaded. A plugin's code has to be loaded at
  runtime from the *target project's* `node_modules`, never bundled into
  kiln's own dist — a fundamentally new code path (built in Phase 3).
- **`SECURITY.md` already scopes in** "arbitrary file write outside the
  target project" and "ownership-tracking integrity bypasses" as
  vulnerability classes. A plugin's `planAdd()` runs with exactly that
  power, unsandboxed, sharing the same mutable `OwnershipTracker`. The
  trust model has to be honest about this, not imply safety that doesn't
  exist.

## Decisions made

| Decision | Choice | Why |
|---|---|---|
| Where does the public plugin contract live? | New, independently-versioned `@kiln/capability-sdk` package | Lets `@kiln/core` evolve freely without ever breaking a published plugin. The cost is one more package to maintain and release — accepted deliberately. |
| Plugin discovery | Explicit opt-in only, via a project-root `kiln.plugins.json` | No naming-convention auto-discovery. Auto-loading anything matching a pattern like `kiln-capability-*` is a typosquat vector (`kiln-capability-atuh`) executed silently at `add` time with full filesystem-write access. |
| Plugin resolution rule | Must be a **direct** dependency in the target project's own `package.json` | No walk-up/transitive resolution. Most auditable option; keeps "what can run" traceable to one file a human already reviews. |
| Version trust | **Exact version pin** in `kiln.plugins.json`, not a semver range | Never silently upgrade trust. The cost (bump the pin by hand on every plugin update) is intentional friction, not an oversight. |
| Sandboxing | None in 2.0.0 | A real sandbox (not Node's `vm`, which is trivially escapable) is a multi-month effort for a single maintainer and still wouldn't stop a plugin from requesting arbitrary installs. Shipping "no sandbox, documented loudly" beats shipping a sandbox that implies safety it doesn't provide. |
| New transform kinds via plugins | Not allowed — the six `TypedTransform` variants stay closed | They're the auditable choke point every capability's filesystem/package.json mutations pass through. A genuinely new primitive ships as a first-party 7th variant in `@kiln/transform-engine`, never something a plugin registers at runtime. |
| SDK compatibility check | Exact-major-number gate only, no semver-range solver | One maintainer, one SDK. A range solver is solving a problem that doesn't exist yet at this project's scale. |
| SDK's dependency on `@kiln/core` | None — structural interfaces, not imports | `@kiln/core` is `private: true`, never published. A published `@kiln/capability-sdk` can't depend on an unpublished workspace package. A plugin only ever *receives* an `OwnershipTracker` instance kiln constructs — it never imports or constructs one itself — so the SDK declares the same method surface as a structural interface. Kiln's real class satisfies it automatically (TypeScript structural typing), with zero runtime coupling. |
| SDK's dependency on `@kiln/transform-engine` | None — same structural approach | Also `private: true`. But `TransformPipeline` is just `TypedTransform[]`, plain data — a plugin never needs `createTransformPipeline()` the function, only the six transform *shapes*, which the SDK declares as structural interfaces. Proven with a real test (`packages/sdk/tests/structural-compatibility.test.ts`) that a real transform-engine-built pipeline satisfies the SDK's type, using `@kiln/core`/`@kiln/transform-engine` as `devDependencies` only (never shipped — see `package.json`'s `files` list). |
| `registerOwnership` in the `Capability` interface | Dropped entirely | It's dead code in the real execution path — `plan-executor.ts` only ever consumes `plan.ownershipRegistrations` and `plan.capability`, never a capability's own `registerOwnership` method. It exists only as test-setup convenience in the first-party packages, and its signature genuinely diverges across all three (different second-argument shapes each). Formalizing a fourth divergent signature for a method nothing in production calls wasn't worth it. |
| Lockfile provenance | Reuse the *existing* optional `resolved`/`integrity` fields on `CapabilityVersion` | No schema change needed. Built-ins keep `resolved: "capability:${id}@${version}"`; plugins get `resolved: "npm:<package>@<version>"`. |

## Phases

Each phase maps to a block of GitHub issues under milestone 2.0.0. Update
the status column as issues close — this table should always reflect
reality, not the plan as originally written.

| Phase | What | Issues | Status |
|---|---|---|---|
| 0 | Groundwork bugfixes — removed dead manifest `hooks`/`validations`; documented + tested the `file-modify` manifest-level alias | #97, #98 | done |
| 1 | Formalize the `Capability` contract — new `@kiln/capability-sdk` package (skeleton done, no `@kiln/core`/`@kiln/transform-engine` dependency — see decisions above), retrofit `EnvCapability.planAdd` to the options-bag shape Auth/Db already use (done), define the interface (done — no `registerOwnership`, see decisions above), migrate all three built-ins to implement it | #99 ✅, #100 ✅, #101 ✅, #102 | in progress |
| 2 | Generalize runtime dispatch (built-ins only, no dynamic loading yet) — `registerCapability()`, open `SupportedCapabilityId`, collapse `CapabilityRuntime`'s three fields into one map, generic `addCapability()` | #103, #104, #105 | open |
| 3 | Dynamic loading + trust model — the risky phase, gets extra scrutiny | #106, #107, #108, #109, #110, #111 | open |
| 4 | Versioning/compatibility contract (docs + release process, no new runtime code) | #112 | open |
| 5 | DX/ecosystem surface — scaffolding generator, reference docs, `kiln plugins list`/`verify` | #113, #114, #115 | open |

### Phase 3 in more detail

This is the one phase that should get a second look before merging — it's
the first code in the project that executes anything kiln didn't ship
itself.

- `kiln.plugins.json` (project root):
  ```json
  { "plugins": [{ "package": "kiln-capability-stripe", "version": "1.4.2" }] }
  ```
- Loader rule, enforced in this order, per entry:
  1. Package must be a direct dependency in the target project's own
     `package.json`.
  2. Installed version must exactly equal the pinned version — mismatch is
     a skip, never a silent trust upgrade.
  3. Resolve and load from the target project's `node_modules`, never from
     kiln's own bundle.
  4. SDK-major-version gate: mismatch is a refusal with a clear message.
- Safe failure mode is non-negotiable: built-ins register unconditionally
  first; each plugin's registration is wrapped in try/catch. A broken
  plugin logs an error and is simply not registered — it must never block
  `env`/`auth`/`db` from working. Proven with adversarial tests (a plugin
  that throws in its constructor, one that throws in `getManifest()`, one
  with a bad SDK version, one with a version-pin mismatch).
- `SECURITY.md` gets an explicit new scope section before this phase ships:
  plugins run in-process, unsandboxed, with the same
  filesystem-write/dependency-install/shared-`OwnershipTracker` privileges
  as built-ins, loaded only if explicitly allowlisted with an exact version
  pin. A plugin attempting to claim a resource a built-in already owns via
  the shared `OwnershipTracker` must be rejected with a conflict error —
  this gets its own adversarial test, since it's no longer accidental risk,
  it's an attack surface.

## Rejected alternatives (recorded so they don't get re-proposed later without re-litigating why)

1. **Naming-convention auto-discovery** (à la Babel/Gatsby — auto-load any
   `kiln-capability-*` dependency). Rejected: typosquat vector, silently
   executed at `add` time with full filesystem-write access.
2. **Custom VM/worker sandbox isolation.** Rejected for 2.0.0: multi-month
   effort for one maintainer, Node's built-in `vm` module is trivially
   escapable, and a plugin still needs to request real dependency installs
   that a sandbox can't meaningfully contain anyway. Revisit only if a real
   incident or a maintainer with security-engineering bandwidth shows up.
3. **Semver-range compatibility solver for the plugin SDK.** Rejected:
   solving a multi-SDK-major-version problem that doesn't exist at this
   project's scale (one maintainer, one SDK). An exact-major gate is
   sufficient; add a real solver only if multiple SDK majors are ever
   simultaneously and deliberately supported in practice.
4. **Opening the `TypedTransform` union to plugin-registered mutation
   kinds.** Rejected: the six variants are the auditable choke point every
   capability's filesystem/package.json mutations pass through. New
   primitives are a first-party, reviewed addition to
   `@kiln/transform-engine`, never a plugin-supplied one.

## Verification checklist (re-run per phase, not just at the end)

1. `bunx turbo run build` and `bunx turbo run test` green.
2. `bun run test:post-deploy` green (built CLI against real temp projects).
3. Phase 2: a registry-registered fake capability round-trips through
   `add`/`remove`/lockfile with zero change to existing env/auth/db
   behavior.
4. Phase 3, with a real throwaway local npm-linked plugin package:
   - a well-formed plugin loads and works end to end via `kiln add <id>`
   - a plugin that throws during load does not prevent `kiln add
     env`/`auth`/`db` from working
   - a version-pin mismatch is skipped with a clear log message, not
     silently trusted
   - `.kiln/lock.json` records `resolved: "npm:..."` for the plugin and the
     existing synthetic form for built-ins
5. Before Phase 3 ships: re-read `SECURITY.md`'s updated scope section
   against the actual loader code and confirm every claim it makes about
   plugin privilege/isolation is literally true of the implementation, not
   aspirational.
