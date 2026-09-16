import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  loadManifestFromFile,
  loadManifestFromJson,
  loadManifestFromObject,
  ManifestValidationError,
  validateManifest,
} from '../src/manifest.js';
import type { CapabilityManifest } from '../src/models.js';
import { capabilityFromManifest } from '../src/state.js';

const envManifestPath = join(
  import.meta.dirname,
  '../../capabilities/env/kiln.manifest.json'
);

describe('capability manifest format', () => {
  test('loads a complete manifest from JSON', () => {
    const manifest = loadManifestFromJson(
      JSON.stringify({
        id: 'env',
        name: 'Environment Variables',
        version: '1.0.0',
        dependencies: [],
        adapters: ['node-adapter'],
        transforms: ['env-example'],
        ownership: {
          files: ['.env.example'],
          envVars: ['DATABASE_URL'],
        },
      })
    );

    expect(manifest.id).toBe('env');
    expect(manifest.ownership?.envVars).toEqual(['DATABASE_URL']);
  });

  test('loads env capability manifest from file', async () => {
    const manifest = await loadManifestFromFile(envManifestPath);

    expect(manifest.id).toBe('env');
    expect(manifest.transformDefinitions?.[0].id).toBe('env-example');
    expect(manifest.ownership?.files).toContain('.env.example');
  });

  test('capabilityFromManifest maps ownership and transform definitions', () => {
    const manifest: CapabilityManifest = {
      id: 'env',
      version: '1.0.0',
      dependencies: [],
      transformDefinitions: [
        { id: 'env-example', type: 'env-mutation', target: '.env.example' },
      ],
      ownership: {
        files: ['.env.example'],
        dependencies: ['dotenv'],
        envVars: ['DATABASE_URL'],
      },
    };

    const capability = capabilityFromManifest(manifest);

    expect(capability.transforms?.[0].id).toBe('env-example');
    expect(capability.files).toEqual(['.env.example']);
    expect(capability.ownedDependencies).toEqual(['dotenv']);
    expect(capability.ownedEnvVars).toEqual(['DATABASE_URL']);
  });

  test('rejects invalid manifest fields', () => {
    expect(() =>
      loadManifestFromObject({
        id: '',
        version: '1.0.0',
        dependencies: [],
      })
    ).toThrow(ManifestValidationError);

    expect(() =>
      loadManifestFromObject({
        id: 'env',
        version: '1.0.0',
        dependencies: [],
        adapters: [123],
      })
    ).toThrow(/adapters/);
  });

  test('validateManifest accepts minimal manifest', () => {
    const manifest: CapabilityManifest = {
      id: 'core',
      version: '1.0.0',
      dependencies: [],
    };

    validateManifest(manifest);
    expect(manifest.dependencies).toEqual([]);
  });
});
