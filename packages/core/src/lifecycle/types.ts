export type LifecyclePhase =
  | 'resolve'
  | 'plan'
  | 'validate'
  | 'transform'
  | 'install'
  | 'finalize';

export const LIFECYCLE_PHASES: LifecyclePhase[] = [
  'resolve',
  'plan',
  'validate',
  'transform',
  'install',
  'finalize',
];

export interface LifecycleContext {
  cwd: string;
  options: Record<string, unknown>;
  state: Record<string, unknown>;
}

export type HookFn<TContext = LifecycleContext> = (context: TContext) => void | Promise<void>;

export type HookEvent = LifecyclePhase | `before:${LifecyclePhase}` | `after:${LifecyclePhase}`;
