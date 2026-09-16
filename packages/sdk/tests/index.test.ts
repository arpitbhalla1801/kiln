import { describe, expect, test } from 'bun:test';
import { SDK_VERSION } from '../src/index.js';

describe('@kiln/capability-sdk', () => {
  test('exposes a version string', () => {
    expect(typeof SDK_VERSION).toBe('string');
    expect(SDK_VERSION.length).toBeGreaterThan(0);
  });
});
