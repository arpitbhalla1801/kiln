# @kiln/capability-sdk

The public, independently-versioned contract for writing a third-party kiln capability plugin. See [docs/plugin-architecture.md](../../docs/plugin-architecture.md) in the kiln repo for the full design and the reasoning behind it.

## Stable surface

Everything re-exported from `src/index.ts` is stable to build a plugin against, and follows semver on this package's own version — a breaking change to any of it is an `@kiln/capability-sdk` major bump, independent of `@kiln-cli/kiln`'s own version:

- **`Capability`** — the interface every plugin implements (`id`, `getManifest`, `getCapability`, `planAdd`).
- **`CapabilityPlanOptions`, `CapabilityPlan`** — the base shape of `planAdd`'s options and return value.
- **`CapabilityManifest`, `ResolvedCapability`, `Transform`, `TransformType`, `OwnershipDeclaration`** — the manifest-level types a plugin's `getManifest()`/`getCapability()` return.
- **`OwnershipTracker`, `OwnershipRegistration`, `OwnershipConflict`, `OwnershipResourceType`** — the structural type of the tracker kiln hands a plugin, and the shape of what a plugin registers through it.
- **The six `TypedTransform` variants** — `FileCreateTransform`, `FilePatchTransform`, `FileDeleteTransform`, `JsonMutationTransform`, `PackageJsonMutationTransform`, `EnvMutationTransform` — plus `TransformBase`, `TransformPipeline`, `JsonMutationOperation`, and `EnvVariableDefinition`. This union is closed and stays closed: a plugin composes these six primitives, it never registers a new mutation kind.

## Explicitly internal — do not depend on these

None of the following are re-exported from this package, and none of them are safe to import directly even if you find them in kiln's own `node_modules` (both `@kiln/core` and `@kiln/transform-engine` are `private: true` and are never published to npm — depending on their internals means your plugin breaks on any kiln release with no warning):

- `TransformApplier` and any other `@kiln/transform-engine` internals beyond the `TypedTransform` shapes.
- `ValidationRunner` and other `@kiln/core` internals beyond the structural types this SDK re-exports.
- Anything in `packages/runtime` that isn't re-exported here — capability dispatch, the plugin loader, and the registry are kiln's own implementation detail, not part of the plugin contract.

If your plugin needs something from this list, it's a sign the SDK is missing a stable primitive — please open an issue rather than reaching into kiln's private packages.

## Why this package has no runtime dependencies

`@kiln/core` and `@kiln/transform-engine` are both `private: true`, unpublished workspace packages — a published `@kiln/capability-sdk` can't depend on either at runtime. Where a plugin needs to work with something kiln constructs and hands it (an `OwnershipTracker` instance), or with something a plugin builds itself as plain data (a `TransformPipeline`, which is just `TypedTransform[]`), this SDK declares the shape as a structural interface instead of importing the concrete implementation. Kiln's real classes and objects satisfy these types automatically, because TypeScript types are structural, not nominal — proven with a real test (`tests/structural-compatibility.test.ts`) using both private packages as `devDependencies` only.
