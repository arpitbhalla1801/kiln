import { HookEvent, HookFn, LifecycleContext } from './types.js';

export class LifecycleHooks<TContext = LifecycleContext> {
  private hooks: Map<HookEvent, HookFn<TContext>[]> = new Map();

  register(event: HookEvent, fn: HookFn<TContext>): void {
    const hooksForEvent = this.hooks.get(event) ?? [];
    hooksForEvent.push(fn);
    this.hooks.set(event, hooksForEvent);
  }

  async execute(event: HookEvent, context: TContext): Promise<void> {
    const hooksForEvent = this.hooks.get(event);
    if (!hooksForEvent) return;

    for (const hook of hooksForEvent) {
      await hook(context);
    }
  }
}
