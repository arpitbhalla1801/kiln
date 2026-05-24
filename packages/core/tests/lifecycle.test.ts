import { describe, expect, test } from 'bun:test';
import { LifecycleExecutor, LifecycleHooks, LifecycleContext } from '../src/lifecycle/index.js';

describe('LifecycleExecutor', () => {
  test('phases execute in order', async () => {
    const hooks = new LifecycleHooks<LifecycleContext>();
    const executor = new LifecycleExecutor<LifecycleContext>(hooks);
    
    const executedPhases: string[] = [];
    
    const phases = ['resolve', 'plan', 'validate', 'transform', 'install', 'finalize'] as const;
    
    phases.forEach((phase) => {
      hooks.register(`before:${phase}`, () => {
        executedPhases.push(`before:${phase}`);
      });
      hooks.register(phase, () => {
        executedPhases.push(phase);
      });
      hooks.register(`after:${phase}`, () => {
        executedPhases.push(`after:${phase}`);
      });
    });

    const context: LifecycleContext = {
      cwd: '/test',
      options: {},
      state: {}
    };

    await executor.execute(context);

    const expectedOrder = [
      'before:resolve', 'resolve', 'after:resolve',
      'before:plan', 'plan', 'after:plan',
      'before:validate', 'validate', 'after:validate',
      'before:transform', 'transform', 'after:transform',
      'before:install', 'install', 'after:install',
      'before:finalize', 'finalize', 'after:finalize'
    ];

    expect(executedPhases).toEqual(expectedOrder);
  });
});
