import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PLUGIN_CONFIG_FILE } from '@kiln/project-model';
import { runPluginsList, runPluginsVerify } from '../src/commands/plugins.js';

const tempRoots: string[] = [];

async function installFakePackage(
  root: string,
  packageName: string,
  version: string,
  indexContent: string
): Promise<void> {
  const packageDir = join(root, 'node_modules', packageName);
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify({
      name: packageName,
      version,
      type: 'module',
      main: 'index.mjs',
      dependencies: { '@kiln/capability-sdk': '^0.1.0' },
    })
  );
  await writeFile(join(packageDir, 'index.mjs'), indexContent);
}

async function createTempProject(
  plugins: Array<{ package: string; version: string }>
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plugins-cmd-'));
  tempRoots.push(root);

  const dependencies = Object.fromEntries(plugins.map((entry) => [entry.package, entry.version]));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'demo-app', version: '1.0.0', dependencies })
  );
  await writeFile(join(root, PLUGIN_CONFIG_FILE), JSON.stringify({ plugins }));

  return root;
}

function captureConsoleLog(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  return { logs, restore: () => (console.log = original) };
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

const VALID_CAPABILITY_MODULE = `
export default {
  id: 'fake-plugin',
  async getManifest() { return { id: 'fake-plugin', version: '1.4.2', dependencies: [] }; },
  async getCapability() { return { id: 'fake-plugin', version: '1.4.2', dependencies: [] }; },
  async planAdd() { return { transforms: [], capability: { id: 'fake-plugin', version: '1.4.2', dependencies: [] }, ownershipRegistrations: [] }; },
};
`;

describe('kiln plugins list', () => {
  test('reports no plugins when kiln.plugins.json is empty', async () => {
    const root = await createTempProject([]);
    const { logs, restore } = captureConsoleLog();

    try {
      await runPluginsList({ cwd: root });
    } finally {
      restore();
    }

    expect(logs.join('\n')).toContain('No plugins listed');
  });

  test('reports a well-formed plugin as loaded', async () => {
    const root = await createTempProject([{ package: 'kiln-capability-fake', version: '1.4.2' }]);
    await installFakePackage(root, 'kiln-capability-fake', '1.4.2', VALID_CAPABILITY_MODULE);

    const { logs, restore } = captureConsoleLog();
    try {
      await runPluginsList({ cwd: root });
    } finally {
      restore();
    }

    expect(logs.join('\n')).toContain("(ok)   kiln-capability-fake@1.4.2 -- loads as capability 'fake-plugin'");
  });

  test('reports a broken plugin as skipped, with the reason', async () => {
    const root = await createTempProject([{ package: 'kiln-capability-fake', version: '1.4.2' }]);
    await installFakePackage(root, 'kiln-capability-fake', '9.9.9', VALID_CAPABILITY_MODULE);

    const { logs, restore } = captureConsoleLog();
    try {
      await runPluginsList({ cwd: root });
    } finally {
      restore();
    }

    const output = logs.join('\n');
    expect(output).toContain('(skip)');
    expect(output).toContain('does not match the version');
  });
});

describe('kiln plugins verify', () => {
  test('reports an ok pin without loading the plugin', async () => {
    const root = await createTempProject([{ package: 'kiln-capability-fake', version: '1.4.2' }]);
    await installFakePackage(root, 'kiln-capability-fake', '1.4.2', 'throw new Error("should never run");');

    const { logs, restore } = captureConsoleLog();
    try {
      await runPluginsVerify({ cwd: root });
    } finally {
      restore();
    }

    expect(logs.join('\n')).toContain('(ok)        kiln-capability-fake@1.4.2');
  });

  test('reports a version-pin mismatch and throws so the CLI exits non-zero', async () => {
    const root = await createTempProject([{ package: 'kiln-capability-fake', version: '1.4.2' }]);
    await installFakePackage(root, 'kiln-capability-fake', '9.9.9', VALID_CAPABILITY_MODULE);

    const { logs, restore } = captureConsoleLog();
    try {
      await expect(runPluginsVerify({ cwd: root })).rejects.toThrow('version-pin mismatch');
    } finally {
      restore();
    }

    const output = logs.join('\n');
    expect(output).toContain('(mismatch)');
    expect(output).toContain('does not match the pinned version');
  });
});
