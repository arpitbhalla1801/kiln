import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll } from 'bun:test';
import { parsePluginConfig, PluginConfigStore } from '../src/plugin-config.js';

const tempRoots: string[] = [];

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plugin-config-'));
  tempRoots.push(root);
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('parsePluginConfig', () => {
  test('parses a well-formed config', () => {
    const config = parsePluginConfig(
      JSON.stringify({ plugins: [{ package: 'kiln-capability-stripe', version: '1.4.2' }] })
    );

    expect(config.plugins).toEqual([{ package: 'kiln-capability-stripe', version: '1.4.2' }]);
  });

  test('parses an empty plugins list', () => {
    expect(parsePluginConfig(JSON.stringify({ plugins: [] }))).toEqual({ plugins: [] });
  });

  test('throws on invalid JSON', () => {
    expect(() => parsePluginConfig('{not json')).toThrow('not valid JSON');
  });

  test('throws when the top level is not an object', () => {
    expect(() => parsePluginConfig('[]')).toThrow('top-level value must be an object');
    expect(() => parsePluginConfig('"a string"')).toThrow('top-level value must be an object');
  });

  test('throws when plugins is missing or not an array', () => {
    expect(() => parsePluginConfig('{}')).toThrow('"plugins" must be an array');
    expect(() => parsePluginConfig(JSON.stringify({ plugins: 'nope' }))).toThrow(
      '"plugins" must be an array'
    );
  });

  test('throws when an entry is missing package or version', () => {
    expect(() => parsePluginConfig(JSON.stringify({ plugins: [{ version: '1.0.0' }] }))).toThrow(
      'plugins[0].package must be a non-empty string'
    );
    expect(() =>
      parsePluginConfig(JSON.stringify({ plugins: [{ package: 'kiln-capability-stripe' }] }))
    ).toThrow('plugins[0].version must be a non-empty string');
  });

  test('throws when an entry is not an object', () => {
    expect(() => parsePluginConfig(JSON.stringify({ plugins: ['stripe'] }))).toThrow(
      'plugins[0] must be an object'
    );
  });
});

describe('PluginConfigStore', () => {
  test('returns an empty config when kiln.plugins.json does not exist', async () => {
    const root = await createTempProject();
    expect(await PluginConfigStore.exists(root)).toBe(false);
    expect(await PluginConfigStore.load(root)).toEqual({ plugins: [] });
  });

  test('loads a well-formed kiln.plugins.json', async () => {
    const root = await createTempProject();
    await writeFile(
      PluginConfigStore.getFilePath(root),
      JSON.stringify({ plugins: [{ package: 'kiln-capability-stripe', version: '1.4.2' }] })
    );

    expect(await PluginConfigStore.exists(root)).toBe(true);
    expect(await PluginConfigStore.load(root)).toEqual({
      plugins: [{ package: 'kiln-capability-stripe', version: '1.4.2' }],
    });
  });

  test('throws loudly on a malformed kiln.plugins.json rather than silently trusting nothing', async () => {
    const root = await createTempProject();
    await writeFile(PluginConfigStore.getFilePath(root), '{not json');

    await expect(PluginConfigStore.load(root)).rejects.toThrow('not valid JSON');
  });
});
