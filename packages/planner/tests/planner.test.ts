import { describe, expect, test } from 'bun:test';
import { ProjectPlanner } from '../src/planner.js';

describe('ProjectPlanner', () => {
  test('generates execution plan with deterministic output and stable ordering', () => {
    const planner = new ProjectPlanner();

    // Add manifests out of order
    planner.addManifest({
      id: 'db',
      dependencies: ['core'],
      transforms: ['transform-db-schema', 'transform-db-client']
    });
    
    planner.addManifest({
      id: 'core',
      dependencies: [],
      transforms: ['transform-base']
    });

    planner.addManifest({
      id: 'auth',
      dependencies: ['core', 'db'],
      transforms: ['transform-auth-middleware']
    });

    const plan = planner.generatePlan();

    // They should resolve in topological order: core -> db -> auth
    // Alphabetical tie-breaking ensures deterministic behavior across identical DAGs
    expect(plan.capabilities.map(c => c.id)).toEqual(['core', 'db', 'auth']);
    
    // Transform order should follow capability resolution order and keep array internals stable
    expect(plan.transforms).toEqual([
      'transform-base',
      'transform-db-schema',
      'transform-db-client',
      'transform-auth-middleware'
    ]);
  });

  test('throws if a capability relies on a missing dependency', () => {
    const planner = new ProjectPlanner();
    planner.addManifest({
      id: 'ui',
      dependencies: ['missing-core']
    });

    expect(() => planner.generatePlan()).toThrow('Node missing-core not found during traversal');
  });

  test('throws if manifests are duplicated', () => {
    const planner = new ProjectPlanner();
    planner.addManifest({ id: 'core', dependencies: [] });
    
    expect(() => {
      planner.addManifest({ id: 'core', dependencies: [] });
    }).toThrow('Manifest with id core already exists');
  });
});
