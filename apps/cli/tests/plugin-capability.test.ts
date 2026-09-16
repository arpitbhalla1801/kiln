import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { capabilityFromManifest } from '@kiln/core';
import type { Capability, CapabilityPlan, CapabilityPlanOptions } from '@kiln/capability-sdk';
import { createCapabilityRuntime, registerCapability } from '@kiln/runtime';
import { createTransformPipeline } from '@kiln/transform-engine';
import { runRemove } from '../src/commands/remove.js';

const tempRoots: string[] = [];

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plugin-'));
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'demo-app', version: '1.0.0' }));
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

const FAKE_PLUGIN_ID = 'fake-plugin';

class FakePluginCapability implements Capability {
  readonly id = FAKE_PLUGIN_ID;

  async getManifest() {
    return {
      id: FAKE_PLUGIN_ID,
      version: '1.0.0',
      dependencies: [],
    };
  }

  async getCapability() {
    return capabilityFromManifest(await this.getManifest());
  }

  async planAdd(_rootPath: string, _options: CapabilityPlanOptions): Promise<CapabilityPlan> {
    const transforms = createTransformPipeline()
      .fileCreate(
        `${FAKE_PLUGIN_ID}-create`,
        'fake-plugin.txt',
        'hello from a third-party capability\n',
        'Create fake plugin file'
      )
      .build();

    return {
      transforms,
      capability: capabilityFromManifest({
        ...(await this.getManifest()),
        ownership: { files: ['fake-plugin.txt'] },
      }),
      ownershipRegistrations: [
        { resourceType: 'file', resourceKey: 'fake-plugin.txt', ownerCapabilityId: FAKE_PLUGIN_ID },
      ],
    };
  }
}

describe('third-party capability registration (Phase 2, no dynamic loading)', () => {
  test('a fake capability registered via registerCapability round-trips through add -> lockfile -> remove', async () => {
    registerCapability(FAKE_PLUGIN_ID);

    const root = await createTempProject();
    const runtime = createCapabilityRuntime({
      capabilities: { [FAKE_PLUGIN_ID]: new FakePluginCapability() },
    });

    const addResult = await runtime.addCapability(FAKE_PLUGIN_ID, { cwd: root, dryRun: false });
    expect(addResult.capabilityId).toBe(FAKE_PLUGIN_ID);
    expect(await readFile(join(root, 'fake-plugin.txt'), 'utf8')).toContain(
      'hello from a third-party capability'
    );

    const lockfile = JSON.parse(await readFile(join(root, '.kiln', 'lock.json'), 'utf8'));
    expect(lockfile.snapshot.capabilities.map((entry: { id: string }) => entry.id)).toContain(
      FAKE_PLUGIN_ID
    );

    await runRemove(FAKE_PLUGIN_ID, { cwd: root });

    await expect(readFile(join(root, 'fake-plugin.txt'), 'utf8')).rejects.toThrow();
  });
});
