import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateProjectName } from '../validation/project-name.js';
import { ensureTargetAvailable } from '../project.js';

const SDK_VERSION_RANGE = '^0.1.0';
const DOCS_BASE = 'https://github.com/arpitbhalla1801/kiln/blob/main/docs';

export async function runInitPlugin(
  targetParentDir: string,
  rawName: string,
  dryRun = false
): Promise<void> {
  const capabilityId = validateProjectName(rawName);
  const packageName = `kiln-capability-${capabilityId}`;
  const pascalName = toPascalCase(capabilityId);
  const constPrefix = capabilityId.toUpperCase().replace(/-/g, '_');
  const targetDir = join(targetParentDir, packageName);

  await ensureTargetAvailable(targetDir, 'plugin');

  if (dryRun) {
    console.log(`Dry run: would create kiln capability plugin '${packageName}' at ${targetDir}`);
    return;
  }

  await mkdir(join(targetDir, 'src'), { recursive: true });
  await mkdir(join(targetDir, 'tests'), { recursive: true });

  const files = buildPluginFiles({ capabilityId, packageName, pascalName, constPrefix });

  for (const [relativePath, content] of Object.entries(files)) {
    await writeFile(join(targetDir, relativePath), content);
  }

  console.log(`Created kiln capability plugin '${packageName}' at ${targetDir}`);
  console.log('Next steps:');
  console.log(`  cd ${packageName}`);
  console.log('  bun install');
  console.log('  bun run build && bun test');
  console.log();
  console.log('To try it in a project, add it as a direct dependency there, then in that');
  console.log("project's kiln.plugins.json:");
  console.log(
    JSON.stringify({ plugins: [{ package: packageName, version: '0.1.0' }] }, null, 2)
  );
  console.log(`Guide: ${DOCS_BASE}/writing-a-plugin.md`);
}

interface PluginNameParts {
  capabilityId: string;
  packageName: string;
  pascalName: string;
  constPrefix: string;
}

function buildPluginFiles(parts: PluginNameParts): Record<string, string> {
  const { capabilityId, packageName, pascalName, constPrefix } = parts;
  const camelName = pascalName[0].toLowerCase() + pascalName.slice(1);
  const modulePath = `src/lib/${capabilityId}.ts`;
  const apiKeyVar = `${constPrefix}_API_KEY`;
  const scriptName = `${capabilityId}:check`;

  const packageJson = {
    name: packageName,
    version: '0.1.0',
    description: 'A third-party kiln capability plugin.',
    keywords: ['kiln-capability'],
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    files: ['dist'],
    dependencies: {
      '@kiln/capability-sdk': SDK_VERSION_RANGE,
    },
    devDependencies: {
      '@types/node': '^25.9.1',
      typescript: '^5.6.0',
    },
    scripts: {
      build: 'tsc -b --force',
      test: 'bun test tests',
    },
  };

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      declaration: true,
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      types: ['node'],
    },
    include: ['src'],
  };

  const manifest = {
    id: capabilityId,
    name: pascalName,
    version: '0.1.0',
    dependencies: [],
    ownership: {
      files: [modulePath],
      dependencies: ['zod'],
      scripts: [scriptName],
      envVars: [apiKeyVar],
    },
  };

  const manifestData = `import type { CapabilityManifest } from '@kiln/capability-sdk';

export const ${constPrefix}_MANIFEST: CapabilityManifest = ${JSON.stringify(manifest, null, 2)};
`;

  const types = `import type { CapabilityPlan, CapabilityPlanOptions } from '@kiln/capability-sdk';

export const ${constPrefix}_CAPABILITY_ID = '${capabilityId}';
export const ${constPrefix}_MODULE_PATH = '${modulePath}';
export const ${constPrefix}_API_KEY = '${apiKeyVar}';

// Replace with the packages and scripts this capability really needs.
export const ${constPrefix}_DEPENDENCIES: Record<string, string> = { zod: '^3.23.8' };
export const ${constPrefix}_SCRIPTS: Record<string, string> = { '${scriptName}': 'echo ${capabilityId} ready' };

export interface ${pascalName}CapabilityPlanOptions extends CapabilityPlanOptions {
  /** Values from \`kiln add ${capabilityId} --var KEY=VALUE\`. */
  variables?: Record<string, string>;
}

export type ${pascalName}CapabilityPlan = CapabilityPlan;
`;

  const templates = `export function create${pascalName}Module(): string {
  return \`import { z } from 'zod';

const env = z.object({ ${apiKeyVar}: z.string().min(1) }).parse(process.env);

export const ${camelName}Config = { apiKey: env.${apiKeyVar} };
\`;
}
`;

  const validation = `import type { OwnershipRegistration } from '@kiln/capability-sdk';
import {
  ${constPrefix}_API_KEY,
  ${constPrefix}_CAPABILITY_ID,
  ${constPrefix}_DEPENDENCIES,
  ${constPrefix}_MODULE_PATH,
  ${constPrefix}_SCRIPTS,
} from './types.js';

// Everything claimed here is what \`kiln remove ${capabilityId}\` takes back: the file,
// the dependency, the script and the env var. Anything not claimed is left alone.
export function build${pascalName}OwnershipRegistrations(): OwnershipRegistration[] {
  const owner = ${constPrefix}_CAPABILITY_ID;
  return [
    { resourceType: 'file', resourceKey: ${constPrefix}_MODULE_PATH, ownerCapabilityId: owner },
    ...Object.keys(${constPrefix}_DEPENDENCIES).map((name) => ({
      resourceType: 'dependency' as const,
      resourceKey: name,
      ownerCapabilityId: owner,
    })),
    ...Object.keys(${constPrefix}_SCRIPTS).map((name) => ({
      resourceType: 'script' as const,
      resourceKey: name,
      ownerCapabilityId: owner,
    })),
    { resourceType: 'envVar', resourceKey: ${constPrefix}_API_KEY, ownerCapabilityId: owner },
  ];
}
`;

  const capability = `import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Capability,
  CapabilityManifest,
  ResolvedCapability,
  TypedTransform,
} from '@kiln/capability-sdk';
import { ${constPrefix}_MANIFEST } from './manifest-data.js';
import { create${pascalName}Module } from './templates.js';
import {
  ${constPrefix}_API_KEY,
  ${constPrefix}_CAPABILITY_ID,
  ${constPrefix}_DEPENDENCIES,
  ${constPrefix}_MODULE_PATH,
  ${constPrefix}_SCRIPTS,
  type ${pascalName}CapabilityPlan,
  type ${pascalName}CapabilityPlanOptions,
} from './types.js';
import { build${pascalName}OwnershipRegistrations } from './validation.js';

export class ${pascalName}Capability implements Capability {
  readonly id = ${constPrefix}_CAPABILITY_ID;

  async getManifest(): Promise<CapabilityManifest> {
    return ${constPrefix}_MANIFEST;
  }

  async getCapability(): Promise<ResolvedCapability> {
    const { id, name, version, dependencies, ownership } = await this.getManifest();
    return {
      id,
      name,
      version,
      dependencies: [...dependencies],
      files: ownership?.files,
      ownedDependencies: ownership?.dependencies,
      ownedScripts: ownership?.scripts,
      ownedEnvVars: ownership?.envVars,
    };
  }

  async planAdd(
    rootPath: string,
    options: ${pascalName}CapabilityPlanOptions
  ): Promise<${pascalName}CapabilityPlan> {
    const id = ${constPrefix}_CAPABILITY_ID;
    const transforms: TypedTransform[] = [];

    // Re-running \`kiln add\` must not clobber a file the user has since edited.
    if (!existsSync(join(rootPath, ${constPrefix}_MODULE_PATH))) {
      transforms.push({
        id: \`\${id}-create-module\`,
        type: 'file-create',
        filePath: ${constPrefix}_MODULE_PATH,
        content: create${pascalName}Module(),
      });
    }

    transforms.push(
      {
        id: \`\${id}-package-json\`,
        type: 'package-json-mutation',
        dependencies: ${constPrefix}_DEPENDENCIES,
        scripts: ${constPrefix}_SCRIPTS,
      },
      // .env.example is committed: placeholder only, never a real value.
      {
        id: \`\${id}-env-example\`,
        type: 'env-mutation',
        filePath: options.envExamplePath ?? '.env.example',
        variables: { [${constPrefix}_API_KEY]: { example: 'replace-me', required: true } },
        section: id,
        preserveExistingValues: true,
      },
      // .env.local is gitignored: gets the value from \`--var ${apiKeyVar}=...\`, if given.
      {
        id: \`\${id}-env-local\`,
        type: 'env-mutation',
        filePath: '.env.local',
        variables: { [${constPrefix}_API_KEY]: options.variables?.[${constPrefix}_API_KEY] ?? '' },
        preserveExistingValues: true,
      }
    );

    // A real value just went into .env.local -- make sure it can't be committed.
    const gitignore = await readFile(join(rootPath, '.gitignore'), 'utf8').catch(() => '');
    if (!gitignore.split(/\\r?\\n/).some((line) => line.trim() === '.env.local')) {
      const separator = gitignore && !gitignore.endsWith('\\n') ? '\\n' : '';
      transforms.push({
        id: \`\${id}-gitignore-env-local\`,
        type: 'file-create',
        filePath: '.gitignore',
        content: \`\${gitignore}\${separator}.env.local\\n\`,
      });
    }

    return {
      transforms,
      capability: await this.getCapability(),
      ownershipRegistrations: build${pascalName}OwnershipRegistrations(),
    };
  }
}

export default new ${pascalName}Capability();
`;

  const index = `export { ${pascalName}Capability, default } from './capability.js';
export * from './types.js';
`;

  const test = `import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import capability from '../src/capability.js';

function emptyProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), '${packageName}-'));
}

describe('${pascalName}Capability', () => {
  test('planAdd creates the module, adds deps/scripts/env, gitignores .env.local, and claims it all', async () => {
    const plan = await capability.planAdd(await emptyProject(), {});

    expect(plan.transforms.map((t) => t.type)).toEqual([
      'file-create',
      'package-json-mutation',
      'env-mutation',
      'env-mutation',
      'file-create',
    ]);
    expect(plan.ownershipRegistrations.map((r) => \`\${r.resourceType}:\${r.resourceKey}\`)).toEqual([
      'file:${modulePath}',
      'dependency:zod',
      'script:${scriptName}',
      'envVar:${apiKeyVar}',
    ]);
  });

  test('--var values go to .env.local only, never .env.example', async () => {
    const plan = await capability.planAdd(await emptyProject(), {
      variables: { ${apiKeyVar}: 'real-secret' },
    });

    const example = plan.transforms.find((t) => t.id === '${capabilityId}-env-example');
    const local = plan.transforms.find((t) => t.id === '${capabilityId}-env-local');
    expect(JSON.stringify(example)).not.toContain('real-secret');
    expect(JSON.stringify(local)).toContain('real-secret');
  });

  test('re-running planAdd leaves an existing module alone', async () => {
    const root = await emptyProject();
    await mkdir(join(root, 'src/lib'), { recursive: true });
    await writeFile(join(root, '${modulePath}'), '// edited by me\\n');

    const plan = await capability.planAdd(root, {});
    expect(plan.transforms.some((t) => t.id === '${capabilityId}-create-module')).toBe(false);
  });
});
`;

  const readme = `# ${packageName}

A kiln capability plugin, scaffolded by \`kiln init-plugin\`.

\`kiln add ${capabilityId}\` creates \`${modulePath}\`, adds \`zod\` and a \`${scriptName}\` script, and adds \`${apiKeyVar}\` to \`.env.example\` (placeholder) and \`.env.local\` (value from \`--var ${apiKeyVar}=...\`). \`kiln remove ${capabilityId}\` takes all of it back. Replace these with what your capability really does.

## Develop

\`\`\`bash
bun install
bun run build
bun test
\`\`\`

## Use in a project

1. \`bun run build\`, then install it in the target project as a **direct** dependency (it must be listed in that project's own \`package.json\`):
   - registry (npm or private): \`npm publish\` here, then \`npm install ${packageName}@0.1.0\` there
   - local path, for development: \`npm install ../${packageName}\` there (links it; rebuild here to pick up changes)
   - git or workspace dependencies work the same way, as long as the installed \`package.json\` version matches the pin
2. Pin the exact installed version in the project's \`kiln.plugins.json\`:

\`\`\`json
{ "plugins": [{ "package": "${packageName}", "version": "0.1.0" }] }
\`\`\`

3. Run \`kiln plugins verify\`, then \`kiln add ${capabilityId} --var ${apiKeyVar}=...\`

To upgrade: release a new version, install it in the project, bump the pin. Kiln skips a plugin whose installed version doesn't match its pin.

## Docs

- Writing a plugin (transforms, ownership, remove, options, testing, distribution): ${DOCS_BASE}/writing-a-plugin.md
- Design and trust model: ${DOCS_BASE}/plugin-architecture.md
- SDK types: \`node_modules/@kiln/capability-sdk/dist/index.d.ts\`
`;

  return {
    'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
    'tsconfig.json': `${JSON.stringify(tsconfig, null, 2)}\n`,
    'kiln.manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'src/manifest-data.ts': manifestData,
    'src/types.ts': types,
    'src/templates.ts': templates,
    'src/validation.ts': validation,
    'src/capability.ts': capability,
    'src/index.ts': index,
    'tests/capability.test.ts': test,
    'README.md': readme,
  };
}

function toPascalCase(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');
}
