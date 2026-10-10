import { describe, expect, test } from 'bun:test';
import type { CapabilityManifest } from '@kiln-cli/core';
import { isVerifiedPlugin, manifestSha256 } from '../src/plugin-verification.js';

const manifest: CapabilityManifest = {
  id: 'widget',
  version: '1.0.0',
  description: 'Adds a widget.',
  frameworks: ['nextjs'],
  providers: [],
  config: [],
  operations: ['add', 'remove'],
  verify: [],
  dependencies: [],
};

describe('plugin verification', () => {
  test('hash ignores key order and changes with content', () => {
    const reordered = Object.fromEntries(Object.entries(manifest).reverse()) as CapabilityManifest;
    expect(manifestSha256(reordered)).toBe(manifestSha256(manifest));
    expect(manifestSha256({ ...manifest, description: 'Different.' })).not.toBe(
      manifestSha256(manifest)
    );
  });

  test('verified only when package, version and manifest all match a reviewed entry', () => {
    const reviewed = [
      { package: 'kiln-capability-widget', version: '1.0.0', manifestSha256: manifestSha256(manifest) },
    ];

    expect(isVerifiedPlugin('kiln-capability-widget', '1.0.0', manifest, reviewed)).toBe(true);
    expect(isVerifiedPlugin('kiln-capability-widget', '1.0.1', manifest, reviewed)).toBe(false);
    expect(isVerifiedPlugin('other', '1.0.0', manifest, reviewed)).toBe(false);
    expect(
      isVerifiedPlugin('kiln-capability-widget', '1.0.0', { ...manifest, verify: [{ command: 'rm -rf /', description: 'x' }] }, reviewed)
    ).toBe(false);
    expect(isVerifiedPlugin('kiln-capability-widget', '1.0.0', manifest, [])).toBe(false);
  });
});
