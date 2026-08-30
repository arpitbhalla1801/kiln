import type { TransformPipeline } from '@kiln/transform-engine';

export function extractInstallDependencies(
  transforms: TransformPipeline
): Record<string, string> {
  const dependencies: Record<string, string> = {};

  for (const transform of transforms) {
    if (transform.type !== 'package-json-mutation') {
      continue;
    }

    if (transform.dependencies) {
      Object.assign(dependencies, transform.dependencies);
    }
  }

  return dependencies;
}
