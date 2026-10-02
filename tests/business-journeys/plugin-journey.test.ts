import { afterAll, describe, expect, test } from 'bun:test';
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand, runKiln } from './cli-runner.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  );

describe('business journey plugin journey', () => {
  // Needs network: the scaffolded plugin installs @kiln-cli/capability-sdk from the real npm registry.
  test('PD-24 through PD-29 scaffold, install from npm, pack, verify, add and remove a plugin', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'kiln-plugin-journey-'));
    tempRoots.push(parent);

    // PD-24 init-plugin output installs and builds on a clean machine
    expect(runKiln(['init-plugin', 'hello'], parent).exitCode).toBe(0);
    const pluginDir = join(parent, 'kiln-capability-hello');
    expect(runCommand('bun', ['install'], pluginDir).exitCode).toBe(0);
    expect(runCommand('bun', ['run', 'build'], pluginDir).exitCode).toBe(0);

    // PD-25 the plugin packs and installs into a fresh app as a direct dependency
    const pack = runCommand('bun', ['pm', 'pack'], pluginDir);
    expect(pack.exitCode).toBe(0);
    const tarball = (await readdir(pluginDir)).find((name) => name.endsWith('.tgz'));
    expect(tarball).toBeDefined();
    expect(runKiln(['init', 'app'], parent).exitCode).toBe(0);
    const appDir = join(parent, 'app');
    const installPlugin = runCommand('bun', ['add', join(pluginDir, tarball as string)], appDir);
    expect(installPlugin.exitCode).toBe(0);

    // PD-26 plugins verify accepts the pinned version
    await writeFile(
      join(appDir, 'kiln.plugins.json'),
      JSON.stringify({ plugins: [{ package: 'kiln-capability-hello', version: '0.1.0' }] })
    );
    const verify = runKiln(['plugins', 'verify'], appDir);
    expect(verify.exitCode).toBe(0);
    expect(verify.output).toContain('(ok)');

    // PD-27 plan add previews the plugin and writes nothing
    const plan = runKiln(['plan', 'add', 'hello'], appDir);
    expect(plan.exitCode).toBe(0);
    expect(plan.stdout).toContain('src/lib/hello.ts');
    expect(await exists(join(appDir, 'src/lib/hello.ts'))).toBe(false);
    expect(runKiln(['inspect'], appDir).stdout).toContain('✗ hello');

    // PD-28 add writes the plugin's files and inspect shows it installed
    expect(runKiln(['add', 'hello'], appDir).exitCode).toBe(0);
    expect(await exists(join(appDir, 'src/lib/hello.ts'))).toBe(true);
    expect(runKiln(['inspect'], appDir).stdout).toContain('✓ hello');

    // PD-29 remove takes the plugin's files back out
    expect(runKiln(['remove', 'hello'], appDir).exitCode).toBe(0);
    expect(await exists(join(appDir, 'src/lib/hello.ts'))).toBe(false);
    expect(runKiln(['inspect'], appDir).stdout).toContain('✗ hello');
  }, 300000);
});
