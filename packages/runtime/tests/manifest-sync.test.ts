import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthCapability } from '@kiln-cli/auth-capability';
import { DbCapability } from '@kiln-cli/db-capability';
import { EnvCapability } from '@kiln-cli/env-capability';

const capabilitiesDir = join(import.meta.dirname, '../../capabilities');

// Each built-in has two copies of its manifest: kiln.manifest.json (for readers)
// and manifest-data.ts (what the bundled CLI loads). They must not drift.
describe('built-in manifest mirrors', () => {
  const builtins = [
    ['env', new EnvCapability()],
    ['auth', new AuthCapability()],
    ['db', new DbCapability()],
  ] as const;

  for (const [id, capability] of builtins) {
    test(`${id}: kiln.manifest.json matches the embedded manifest`, async () => {
      const onDisk = JSON.parse(await readFile(join(capabilitiesDir, id, 'kiln.manifest.json'), 'utf8'));
      const embedded = JSON.parse(JSON.stringify(await capability.getManifest()));

      expect(embedded).toEqual(onDisk);
    });
  }
});
