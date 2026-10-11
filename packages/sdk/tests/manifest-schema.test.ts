/**
 * Keeps capability.schema.json honest: its `required` list must be exactly
 * what kiln's own manifest validation enforces, so the published schema and
 * the loader can't disagree. @kiln-cli/core is a devDependency for this only.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadManifestFromObject } from '@kiln-cli/core';

const schema = JSON.parse(
  readFileSync(join(import.meta.dirname, '../capability.schema.json'), 'utf8')
) as { required: string[]; properties: Record<string, unknown> };

const complete: Record<string, unknown> = {
  id: 'widget',
  version: '1.0.0',
  description: 'Adds a widget.',
  frameworks: ['nextjs'],
  providers: [],
  config: [],
  operations: ['add'],
  verify: [],
  dependencies: [],
};

describe('capability.schema.json', () => {
  test('required fields are exactly the ones kiln enforces', () => {
    const enforced = Object.keys(complete).filter((field) => {
      const { [field]: _omitted, ...rest } = complete;
      try {
        loadManifestFromObject(rest);
        return false;
      } catch {
        return true;
      }
    });

    expect([...schema.required].sort()).toEqual(enforced.sort());
  });

  test('describes every manifest field kiln reads', () => {
    const optional = [
      'name',
      'enhances',
      'adapters',
      'transforms',
      'transformDefinitions',
      'ownership',
      'files',
    ];

    for (const field of [...Object.keys(complete), ...optional]) {
      expect(Object.keys(schema.properties)).toContain(field);
    }
  });
});
