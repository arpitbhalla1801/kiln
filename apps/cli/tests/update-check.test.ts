import { describe, expect, test } from 'bun:test';
import { checkForUpdate } from '../src/update-check.js';

describe('checkForUpdate', () => {
  test('does not throw when the registry is unreachable or the cache is missing', async () => {
    await expect(checkForUpdate('1.0.2')).resolves.toBeUndefined();
  });
});
