import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Catalog {
  journeys: Array<{ cases: Array<{ id: string }> }>;
}

describe('post-deploy catalog', () => {
  test('catalog IDs are referenced by test files', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const catalog = JSON.parse(readFileSync(join(dir, 'catalog.json'), 'utf8')) as Catalog;
    const ids = catalog.journeys.flatMap((journey) => journey.cases.map((testCase) => testCase.id));
    expect(ids.length).toBeGreaterThan(0);

    const sources = ['cli-contract.test.ts', 'new-project-journey.test.ts', 'upgrade-compat.test.ts']
      .map((fileName) => readFileSync(join(dir, fileName), 'utf8'))
      .join('\n');

    for (const id of ids) {
      expect(sources).toContain(id);
    }
  });
});
