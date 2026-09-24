import { cloneJson, mergeStringRecords, StructuredMutationEngine } from './mutation-engine.js';

export interface PackageJsonMergeInput {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  removeDependencies?: string[];
  removeDevDependencies?: string[];
  removeScripts?: string[];
}

const mutationEngine = new StructuredMutationEngine();

/** Idempotent merge logic for package.json documents. */
export class PackageJsonMerger {
  merge(
    current: Record<string, unknown>,
    input: PackageJsonMergeInput
  ): Record<string, unknown> {
    const packageJson = cloneJson(current);

    if (input.dependencies) {
      const dependencies = packageJson.dependencies as Record<string, string> | undefined;
      packageJson.dependencies = mergeStringRecords(dependencies ?? {}, input.dependencies);
    }

    if (input.devDependencies) {
      const devDependencies = packageJson.devDependencies as Record<string, string> | undefined;
      packageJson.devDependencies = mergeStringRecords(
        devDependencies ?? {},
        input.devDependencies
      );
    }

    if (input.scripts) {
      const scripts = packageJson.scripts as Record<string, string> | undefined;
      packageJson.scripts = mergeStringRecords(scripts ?? {}, input.scripts);
    }

    for (const dependency of input.removeDependencies ?? []) {
      removeRecordKey(packageJson, 'dependencies', dependency);
    }

    for (const dependency of input.removeDevDependencies ?? []) {
      removeRecordKey(packageJson, 'devDependencies', dependency);
    }

    for (const script of input.removeScripts ?? []) {
      removeRecordKey(packageJson, 'scripts', script);
    }

    // Keep the user's own top-level key order; only the dependency and script maps are sorted.
    return packageJson;
  }

  mergeToString(current: Record<string, unknown>, input: PackageJsonMergeInput): string {
    const merged = this.merge(current, input);
    return mutationEngine.serialize(merged, { preserveKeyOrder: true });
  }

}

function removeRecordKey(
  packageJson: Record<string, unknown>,
  field: 'dependencies' | 'devDependencies' | 'scripts',
  key: string
): void {
  const record = packageJson[field] as Record<string, string> | undefined;
  if (!record || !(key in record)) {
    return;
  }

  delete record[key];
  packageJson[field] = mergeStringRecords(record, {});
}
