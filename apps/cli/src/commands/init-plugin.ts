import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateProjectName } from '../validation/project-name.js';
import { ensureTargetAvailable } from '../project.js';

const SDK_VERSION_RANGE = '^0.1.0';

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
}

interface PluginNameParts {
  capabilityId: string;
  packageName: string;
  pascalName: string;
  constPrefix: string;
}

function buildPluginFiles(parts: PluginNameParts): Record<string, string> {
  const { capabilityId, packageName, pascalName, constPrefix } = parts;
  const dataFile = `${capabilityId}.txt`;

  const packageJson = {
    name: packageName,
    version: '0.1.0',
    description: 'A third-party kiln capability plugin.',
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
      files: [dataFile],
    },
  };

  const manifestData = `import type { CapabilityManifest } from '@kiln/capability-sdk';

export const ${constPrefix}_MANIFEST: CapabilityManifest = ${JSON.stringify(manifest, null, 2)};
`;

  const types = `import type { CapabilityPlan, CapabilityPlanOptions } from '@kiln/capability-sdk';

export const ${constPrefix}_CAPABILITY_ID = '${capabilityId}';

// Extend these with fields specific to this capability's planAdd options/result.
export type ${pascalName}CapabilityPlanOptions = CapabilityPlanOptions;

export type ${pascalName}CapabilityPlan = CapabilityPlan;
`;

  const templates = `export function create${pascalName}FileContent(): string {
  return 'Hello from the ${capabilityId} capability!\\n';
}
`;

  const validation = `import type { OwnershipRegistration } from '@kiln/capability-sdk';
import { ${constPrefix}_CAPABILITY_ID } from './types.js';

export function build${pascalName}OwnershipRegistrations(): OwnershipRegistration[] {
  return [
    {
      resourceType: 'file',
      resourceKey: '${dataFile}',
      ownerCapabilityId: ${constPrefix}_CAPABILITY_ID,
    },
  ];
}
`;

  const capability = `import type {
  Capability,
  CapabilityManifest,
  ResolvedCapability,
} from '@kiln/capability-sdk';
import { ${constPrefix}_MANIFEST } from './manifest-data.js';
import { create${pascalName}FileContent } from './templates.js';
import {
  ${constPrefix}_CAPABILITY_ID,
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
    const manifest = await this.getManifest();
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      dependencies: [...manifest.dependencies],
      files: manifest.ownership?.files ? [...manifest.ownership.files] : undefined,
    };
  }

  // rootPath and options are unused in this scaffold -- read from them once
  // this capability's planAdd needs to inspect the target project or accept
  // caller-supplied options.
  async planAdd(
    _rootPath: string,
    _options: ${pascalName}CapabilityPlanOptions
  ): Promise<${pascalName}CapabilityPlan> {
    return {
      transforms: [
        {
          id: \`\${${constPrefix}_CAPABILITY_ID}-create\`,
          type: 'file-create',
          filePath: '${dataFile}',
          content: create${pascalName}FileContent(),
          description: 'Create ${dataFile}',
        },
      ],
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
import capability from '../src/capability.js';

describe('${pascalName}Capability', () => {
  test('has the expected id', () => {
    expect(capability.id).toBe('${capabilityId}');
  });

  test('planAdd creates the expected file with the expected ownership claim', async () => {
    const plan = await capability.planAdd('/tmp/does-not-matter', {});

    expect(plan.transforms).toHaveLength(1);
    expect(plan.transforms[0]).toMatchObject({ type: 'file-create', filePath: '${dataFile}' });
    expect(plan.ownershipRegistrations).toEqual([
      { resourceType: 'file', resourceKey: '${dataFile}', ownerCapabilityId: '${capabilityId}' },
    ]);
  });
});
`;

  const readme = `# ${packageName}

A third-party kiln capability plugin, scaffolded by \`kiln init-plugin\`.

## Develop

\`\`\`bash
bun install
bun run build
bun test
\`\`\`

## Use in a project

1. Publish this package (or \`bun link\` it locally), then add it as a **direct** dependency of the target project's own \`package.json\`.
2. Add it to that project's \`kiln.plugins.json\`, pinned to the exact installed version:

\`\`\`json
{ "plugins": [{ "package": "${packageName}", "version": "0.1.0" }] }
\`\`\`

Kiln only loads plugins that are an exact-version-pinned, direct dependency of the target project -- see \`docs/plugin-architecture.md\` in the kiln repo for the full trust model.
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

