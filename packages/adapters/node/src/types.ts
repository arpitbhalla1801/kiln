export type PackageManagerKind = 'bun' | 'npm' | 'pnpm' | 'yarn';

export interface PackageManagerInfo {
  kind: PackageManagerKind;
  lockfile?: string;
  installed: boolean;
}

export type NextJsRouter = 'app' | 'pages' | 'unknown';

export interface NextJsInfo {
  detected: boolean;
  router?: NextJsRouter;
  typescript: boolean;
  version?: string;
}

export interface FilesystemExpectations {
  packageJson: boolean;
  nodeModules: boolean;
  lockfile?: string;
}

export interface ProjectInspection {
  rootPath: string;
  packageManager: PackageManagerInfo;
  nextjs: NextJsInfo;
  filesystem: FilesystemExpectations;
  hasPackageJson: boolean;
  hasTypeScript: boolean;
  packageName?: string;
  packageVersion?: string;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface DependencyInstallOptions {
  dev?: boolean;
}

export interface NodeAdapterRuntime {
  inspect(rootPath: string): Promise<ProjectInspection>;
  getFilesystemExpectations(rootPath: string): Promise<FilesystemExpectations>;
  installDependencies(
    rootPath: string,
    dependencies: Record<string, string>,
    options?: DependencyInstallOptions
  ): Promise<CommandResult>;
  removeDependencies(rootPath: string, names: string[]): Promise<CommandResult>;
  runScript(rootPath: string, script: string, args?: string[]): Promise<CommandResult>;
}
