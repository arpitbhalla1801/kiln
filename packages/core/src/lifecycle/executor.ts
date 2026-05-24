import { LifecycleContext, LIFECYCLE_PHASES } from './types.js';
import { LifecycleHooks } from './hooks.js';

export class LifecycleExecutor<TContext = LifecycleContext> {
  private hooks: LifecycleHooks<TContext>;

  constructor(hooks?: LifecycleHooks<TContext>) {
    this.hooks = hooks ?? new LifecycleHooks<TContext>();
  }

  getHooks(): LifecycleHooks<TContext> {
    return this.hooks;
  }

  async execute(context: TContext): Promise<TContext> {
    for (const phase of LIFECYCLE_PHASES) {
      await this.hooks.execute(`before:${phase}`, context);
      await this.hooks.execute(phase, context);
      await this.hooks.execute(`after:${phase}`, context);
    }
    return context;
  }
}
