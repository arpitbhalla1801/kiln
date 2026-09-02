export interface PackageJsonValidationResult {
  status: 'pass' | 'fail';
  detail: string;
}

export function validatePackageJson(
  packageJson: Record<string, unknown>,
  options: { expectsNextJs: boolean }
): PackageJsonValidationResult {
  const issues: string[] = [];

  if (typeof packageJson.name !== 'string' || packageJson.name.trim().length === 0) {
    issues.push('missing project name');
  }

  if (options.expectsNextJs) {
    const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
    const dependencies = isRecord(packageJson.dependencies) ? packageJson.dependencies : {};

    for (const script of ['dev', 'build'] as const) {
      if (typeof scripts[script] !== 'string' || scripts[script].trim().length === 0) {
        issues.push(`missing scripts.${script}`);
      }
    }

    for (const dependency of ['next', 'react'] as const) {
      if (typeof dependencies[dependency] !== 'string' || dependencies[dependency].trim().length === 0) {
        issues.push(`missing dependencies.${dependency}`);
      }
    }
  }

  if (issues.length === 0) {
    return { status: 'pass', detail: 'valid' };
  }

  return {
    status: 'fail',
    detail: issues.join(', '),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
