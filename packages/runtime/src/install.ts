import type { TransformPipeline } from '@kiln/transform-engine';

export interface InstallDependencies {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export function extractInstallDependencies(transforms: TransformPipeline): InstallDependencies {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  for (const transform of transforms) {
    if (transform.type !== 'package-json-mutation') {
      continue;
    }

    if (transform.dependencies) {
      Object.assign(dependencies, transform.dependencies);
    }

    if (transform.devDependencies) {
      Object.assign(devDependencies, transform.devDependencies);
    }
  }

  return { dependencies, devDependencies };
}
