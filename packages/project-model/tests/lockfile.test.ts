import { describe, expect, test } from 'bun:test';
import { LockfileManager } from '../src/lockfile.js';
import { KilnLockfile } from '../src/types.js';

describe('LockfileManager', () => {
  test('generates deterministic lockfile string', () => {
    const lockfile: KilnLockfile = {
      lockfileVersion: 1,
      project: {
        name: 'my-project',
        version: '1.0.0',
      },
      snapshot: {
        timestamp: '2026-05-23T00:00:00.000Z',
        engineVersion: '0.1.0',
        capabilities: [
          {
            id: 'b-cap',
            version: '1.2.0',
            resolved: 'b-cap@1.2.0',
            dependencies: {
              'z-dep': '^1.0.0',
              'a-dep': '^2.0.0'
            }
          },
          {
            id: 'a-cap',
            version: '2.0.0',
            resolved: 'a-cap@2.0.0',
            dependencies: {}
          }
        ]
      }
    };

    const output = LockfileManager.generate(lockfile);
    const parsed = JSON.parse(output);

    // Capabilities sorted alphabetically
    expect(parsed.snapshot.capabilities[0].id).toBe('a-cap');
    expect(parsed.snapshot.capabilities[1].id).toBe('b-cap');

    // Dependencies sorted alphabetically
    const keys = Object.keys(parsed.snapshot.capabilities[1].dependencies);
    expect(keys).toEqual(['a-dep', 'z-dep']);
  });

  test('deterministic reload works', () => {
    const rawJSON = `{
  "lockfileVersion": 1,
  "project": {
    "name": "my-project",
    "version": "1.0.0"
  },
  "snapshot": {
    "timestamp": "2026-05-23T00:00:00.000Z",
    "engineVersion": "0.1.0",
    "capabilities": [
      {
        "id": "a-cap",
        "version": "2.0.0",
        "resolved": "a-cap@2.0.0",
        "dependencies": {}
      },
      {
        "id": "b-cap",
        "version": "1.2.0",
        "resolved": "b-cap@1.2.0",
        "dependencies": {
          "a-dep": "^2.0.0",
          "z-dep": "^1.0.0"
        }
      }
    ]
  }
}
`;

    // Parse existing JSON
    const parsed = LockfileManager.parse(rawJSON);
    
    // Regenerate and ensure exact deep structural match down to raw string
    const regenerated = LockfileManager.generate(parsed);
    expect(regenerated).toBe(rawJSON);
  });

  test('throws on invalid lockfile parsing', () => {
    expect(() => LockfileManager.parse('{}')).toThrow('Invalid lockfile format: missing required top-level fields');
  });
});
