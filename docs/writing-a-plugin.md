# Writing a third-party kiln capability plugin: hello world

This walks through the smallest possible kiln plugin end to end — a capability
called `hello-world` that creates one file, `hello-world.txt`, when a project
runs `kiln add hello-world`. Everything here is copy-pasteable; the fastest
path is actually to run:

```bash
kiln init-plugin hello-world
```

which generates exactly the file tree below. This doc explains what that
scaffold contains and why, for when you want to write one by hand or
understand what the generator produced.

See [docs/plugin-architecture.md](plugin-architecture.md) for the full design
and trust model this plugin has to satisfy.

## File tree

```
kiln-capability-hello-world/
├── package.json
├── tsconfig.json
├── kiln.manifest.json
├── README.md
├── src/
│   ├── manifest-data.ts
│   ├── types.ts
│   ├── templates.ts
│   ├── validation.ts
│   ├── capability.ts
│   └── index.ts
└── tests/
    └── capability.test.ts
```

## `package.json`

Depends only on `@kiln/capability-sdk` — never `@kiln/core` or
`@kiln/transform-engine`, which are private, unpublished workspace packages
kiln itself uses internally:

```json
{
  "name": "kiln-capability-hello-world",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "dependencies": {
    "@kiln/capability-sdk": "^0.1.0"
  },
  "devDependencies": {
    "@types/node": "^25.9.1",
    "typescript": "^5.6.0"
  },
  "scripts": {
    "build": "tsc -b --force",
    "test": "bun test tests"
  }
}
```

## `kiln.manifest.json`

Declares the capability's identity and what it owns. `ownership.files`
matters: it's what lets kiln's `OwnershipTracker` reject a different
capability trying to claim the same file later.

```json
{
  "id": "hello-world",
  "name": "HelloWorld",
  "version": "0.1.0",
  "dependencies": [],
  "ownership": {
    "files": ["hello-world.txt"]
  }
}
```

## `src/manifest-data.ts`

The same manifest, as a typed constant a plugin's `getManifest()` returns:

```ts
import type { CapabilityManifest } from '@kiln/capability-sdk';

export const HELLO_WORLD_MANIFEST: CapabilityManifest = {
  id: 'hello-world',
  name: 'HelloWorld',
  version: '0.1.0',
  dependencies: [],
  ownership: {
    files: ['hello-world.txt'],
  },
};
```

## `src/types.ts`

Extend the SDK's base plan/options types here once this capability needs
fields of its own (see `packages/capabilities/auth/src/types.ts` in the kiln
repo for what that looks like at a larger scale — providers, extra env vars,
etc.). Hello world needs none of that:

```ts
import type { CapabilityPlan, CapabilityPlanOptions } from '@kiln/capability-sdk';

export const HELLO_WORLD_CAPABILITY_ID = 'hello-world';

export type HelloWorldCapabilityPlanOptions = CapabilityPlanOptions;
export type HelloWorldCapabilityPlan = CapabilityPlan;
```

## `src/templates.ts`

The actual file content this capability creates:

```ts
export function createHelloWorldFileContent(): string {
  return 'Hello from the hello-world capability!\n';
}
```

## `src/validation.ts`

What this capability's `planAdd` will register with the shared
`OwnershipTracker` — this is the part that's structurally enforced against
collisions with other capabilities, first-party or plugin:

```ts
import type { OwnershipRegistration } from '@kiln/capability-sdk';
import { HELLO_WORLD_CAPABILITY_ID } from './types.js';

export function buildHelloWorldOwnershipRegistrations(): OwnershipRegistration[] {
  return [
    {
      resourceType: 'file',
      resourceKey: 'hello-world.txt',
      ownerCapabilityId: HELLO_WORLD_CAPABILITY_ID,
    },
  ];
}
```

## `src/capability.ts`

The `Capability` implementation itself. `planAdd` returns one `file-create`
transform — a plugin composes kiln's six closed transform kinds, it never
invents a new one. Note there's no `createTransformPipeline()` builder here:
that helper lives in the private `@kiln/transform-engine` package, so a
plugin constructs the transform objects directly instead:

```ts
import type {
  Capability,
  CapabilityManifest,
  ResolvedCapability,
} from '@kiln/capability-sdk';
import { HELLO_WORLD_MANIFEST } from './manifest-data.js';
import { createHelloWorldFileContent } from './templates.js';
import {
  HELLO_WORLD_CAPABILITY_ID,
  type HelloWorldCapabilityPlan,
  type HelloWorldCapabilityPlanOptions,
} from './types.js';
import { buildHelloWorldOwnershipRegistrations } from './validation.js';

export class HelloWorldCapability implements Capability {
  readonly id = HELLO_WORLD_CAPABILITY_ID;

  async getManifest(): Promise<CapabilityManifest> {
    return HELLO_WORLD_MANIFEST;
  }

  async getCapability(): Promise<ResolvedCapability> {
    const manifest = await this.getManifest();
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      dependencies: [...manifest.dependencies],
      files: manifest.ownership?.files ? [...manifest.ownership.files] : undefined,
    };
  }

  async planAdd(
    _rootPath: string,
    _options: HelloWorldCapabilityPlanOptions
  ): Promise<HelloWorldCapabilityPlan> {
    return {
      transforms: [
        {
          id: `${HELLO_WORLD_CAPABILITY_ID}-create`,
          type: 'file-create',
          filePath: 'hello-world.txt',
          content: createHelloWorldFileContent(),
          description: 'Create hello-world.txt',
        },
      ],
      capability: await this.getCapability(),
      ownershipRegistrations: buildHelloWorldOwnershipRegistrations(),
    };
  }
}

export default new HelloWorldCapability();
```

## `src/index.ts`

kiln's loader looks for a default export (or a named `capability` export)
implementing `Capability` — export both a default instance and the class:

```ts
export { HelloWorldCapability, default } from './capability.js';
export * from './types.js';
```

## Loading it in a project

1. Publish `kiln-capability-hello-world` (or `bun link` it locally for testing).
2. In the **target project**, add it as a direct dependency:
   ```bash
   npm install kiln-capability-hello-world@0.1.0
   ```
3. In that project's `kiln.plugins.json`, pin the exact installed version:
   ```json
   { "plugins": [{ "package": "kiln-capability-hello-world", "version": "0.1.0" }] }
   ```
4. Run `kiln add hello-world`. Kiln loads the plugin, checks it's a direct
   dependency with a matching version pin and a compatible SDK major
   (rejecting it with a clear message otherwise — see
   `packages/runtime/src/plugin-loader.ts`), and creates `hello-world.txt`.

That's the whole loop. For what happens when a plugin is broken instead of
well-formed — throws in its constructor, throws in `getManifest()`, targets
the wrong SDK major — see the "Third-party capability plugins" section of
[SECURITY.md](../SECURITY.md) and the adversarial tests in
`packages/runtime/tests/plugin-safety.test.ts`.
