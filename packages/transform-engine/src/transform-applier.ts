import type {
  EnvMutationTransform,
  EnvVariableDefinition,
  FilePatchTransform,
  JsonMutationTransform,
  PackageJsonMutationTransform,
  TransformPipeline,
  TypedTransform,
} from './transform-types.js';
import type { VirtualFilesystem } from './vfs.js';

/** Applies typed transforms to a virtual filesystem. */
export class TransformApplier {
  apply(vfs: VirtualFilesystem, transform: TypedTransform): void {
    switch (transform.type) {
      case 'file-create':
        vfs.write(normalizePath(transform.filePath), transform.content);
        return;
      case 'file-patch':
        applyFilePatch(vfs, transform);
        return;
      case 'json-mutation':
        applyJsonMutation(vfs, transform);
        return;
      case 'package-json-mutation':
        applyPackageJsonMutation(vfs, transform);
        return;
      case 'env-mutation':
        applyEnvMutation(vfs, transform);
        return;
      default:
        throw new Error(`Unsupported transform type: ${(transform as TypedTransform).type}`);
    }
  }

  applyAll(vfs: VirtualFilesystem, transforms: TransformPipeline): void {
    for (const transform of transforms) {
      this.apply(vfs, transform);
    }
  }
}

function applyFilePatch(vfs: VirtualFilesystem, transform: FilePatchTransform): void {
  const filePath = normalizePath(transform.filePath);
  const current = vfs.read(filePath);

  if (current === undefined) {
    throw new Error(`Cannot patch missing file: ${filePath}`);
  }

  if (!current.includes(transform.search)) {
    throw new Error(`Patch search text not found in file: ${filePath}`);
  }

  vfs.write(filePath, current.replace(transform.search, transform.replace));
}

function applyJsonMutation(vfs: VirtualFilesystem, transform: JsonMutationTransform): void {
  const filePath = normalizePath(transform.filePath);
  const current = vfs.read(filePath);
  const document = current ? parseJson(current, filePath) : {};
  const operation = transform.operation ?? 'set';

  if (operation === 'delete') {
    deleteJsonPath(document, transform.path);
  } else {
    setJsonPath(document, transform.path, transform.value);
  }

  vfs.write(filePath, stringifyJson(document));
}

function applyPackageJsonMutation(vfs: VirtualFilesystem, transform: PackageJsonMutationTransform): void {
  const filePath = normalizePath(transform.filePath ?? 'package.json');
  const current = vfs.read(filePath);
  const packageJson = current ? parseJson(current, filePath) : {};

  if (transform.dependencies) {
    packageJson.dependencies = mergeRecords(packageJson.dependencies ?? {}, transform.dependencies);
  }

  if (transform.devDependencies) {
    packageJson.devDependencies = mergeRecords(
      packageJson.devDependencies ?? {},
      transform.devDependencies
    );
  }

  if (transform.scripts) {
    packageJson.scripts = mergeRecords(packageJson.scripts ?? {}, transform.scripts);
  }

  for (const dependency of transform.removeDependencies ?? []) {
    delete packageJson.dependencies?.[dependency];
  }

  for (const dependency of transform.removeDevDependencies ?? []) {
    delete packageJson.devDependencies?.[dependency];
  }

  for (const script of transform.removeScripts ?? []) {
    delete packageJson.scripts?.[script];
  }

  vfs.write(filePath, stringifyJson(packageJson));
}

function applyEnvMutation(vfs: VirtualFilesystem, transform: EnvMutationTransform): void {
  const filePath = normalizePath(transform.filePath);
  const current = vfs.read(filePath) ?? '';
  const lines = parseEnvLines(current);
  const lineMap = new Map(lines.map((line) => [line.key, line]));

  for (const [key, definition] of Object.entries(transform.variables)) {
    const normalized = normalizeEnvDefinition(definition);
    const existing = lineMap.get(key);

    lineMap.set(key, {
      key,
      value: normalized.value ?? existing?.value,
      example: normalized.example ?? existing?.example,
      required: normalized.required ?? existing?.required,
    });
  }

  const mergedLines = Array.from(lineMap.values()).sort((left, right) =>
    left.key.localeCompare(right.key)
  );

  vfs.write(filePath, formatEnvLines(mergedLines));
}

interface EnvLine {
  key: string;
  value?: string;
  example?: string;
  required?: boolean;
}

function parseEnvLines(content: string): EnvLine[] {
  const lines: EnvLine[] = [];

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    lines.push({ key, value });
  }

  return lines;
}

function formatEnvLines(lines: EnvLine[]): string {
  const rendered = lines.map((line) => {
    const value = line.example ?? line.value ?? '';
    return `${line.key}=${value}`;
  });

  return rendered.length > 0 ? `${rendered.join('\n')}\n` : '';
}

function normalizeEnvDefinition(
  definition: string | EnvVariableDefinition
): EnvVariableDefinition {
  if (typeof definition === 'string') {
    return { example: definition };
  }

  return definition;
}

function parseJson(content: string, filePath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('JSON root must be an object');
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid JSON in '${filePath}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function stringifyJson(value: Record<string, unknown>): string {
  return `${JSON.stringify(sortJsonKeys(value), null, 2)}\n`;
}

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonKeys(entry));
  }

  if (typeof value === 'object' && value !== null) {
    const sortedEntries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );

    return Object.fromEntries(sortedEntries.map(([key, entry]) => [key, sortJsonKeys(entry)]));
  }

  return value;
}

function mergeRecords(
  target: Record<string, string>,
  source: Record<string, string>
): Record<string, string> {
  return sortRecord({ ...target, ...source });
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right))
  );
}

function setJsonPath(target: Record<string, unknown>, jsonPath: string, value: unknown): void {
  const segments = jsonPath.split('.').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('JSON path must not be empty');
  }

  let current: Record<string, unknown> = target;

  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    const next = current[segment];

    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
}

function deleteJsonPath(target: Record<string, unknown>, jsonPath: string): void {
  const segments = jsonPath.split('.').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('JSON path must not be empty');
  }

  let current: Record<string, unknown> = target;

  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    const next = current[segment];

    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      return;
    }

    current = next as Record<string, unknown>;
  }

  delete current[segments[segments.length - 1]];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
}
