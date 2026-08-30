export const name = '@kiln/node-adapter';

export { NodeAdapter } from './adapter.js';
export { detectNextJs } from './detection/nextjs.js';
export { detectLockfile, detectPackageManager } from './detection/package-manager.js';
export { bunAdd, bunRemove, runPackageManagerScript } from './package-manager/bun.js';
export type {
  CommandResult,
  DependencyInstallOptions,
  FilesystemExpectations,
  NextJsInfo,
  NextJsRouter,
  NodeAdapterRuntime,
  PackageManagerInfo,
  PackageManagerKind,
  ProjectInspection,
} from './types.js';
