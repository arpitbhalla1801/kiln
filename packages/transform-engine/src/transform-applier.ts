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
import { StructuredMutationEngine } from './mutation-engine.js';
import { PackageJsonMerger } from './package-json-merger.js';
import { normalizePath } from './path-utils.js';

const mutationEngine = new StructuredMutationEngine();
const packageJsonMerger = new PackageJsonMerger();

/** Applies typed transforms to a virtual filesystem. */
export class TransformApplier {
  apply(vfs: VirtualFilesystem, transform: TypedTransform): void {
    switch (transform.type) {
      case 'file-create':
        applyFileCreate(vfs, transform.filePath, transform.content);
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

function applyFileCreate(vfs: VirtualFilesystem, filePath: string, content: string): void {
  const normalizedPath = normalizePath(filePath);
  const current = vfs.read(normalizedPath);

  if (current === content) {
    return;
  }

  vfs.write(normalizedPath, content);
}

function applyFilePatch(vfs: VirtualFilesystem, transform: FilePatchTransform): void {
  const filePath = normalizePath(transform.filePath);
  const current = vfs.read(filePath);

  if (current === undefined) {
    throw new Error(`Cannot patch missing file: ${filePath}`);
  }

  if (current.includes(transform.search)) {
    const patched = current.replace(transform.search, transform.replace);
    if (patched !== current) {
      vfs.write(filePath, patched);
    }
    return;
  }

  if (current.includes(transform.replace)) {
    return;
  }

  throw new Error(`Patch search text not found in file: ${filePath}`);
}

function applyJsonMutation(vfs: VirtualFilesystem, transform: JsonMutationTransform): void {
  const filePath = normalizePath(transform.filePath);
  const current = vfs.read(filePath);
  const document = current ? mutationEngine.parse(current, filePath) : {};
  const operation = transform.operation ?? 'set';

  if (operation === 'delete') {
    mutationEngine.apply(document, { type: 'delete', path: transform.path });
  } else {
    mutationEngine.apply(document, {
      type: 'set',
      path: transform.path,
      value: transform.value,
    });
  }

  const serialized = mutationEngine.serialize(document);
  const existing = current ?? '';

  if (serialized !== existing) {
    vfs.write(filePath, serialized);
  }
}

function applyPackageJsonMutation(vfs: VirtualFilesystem, transform: PackageJsonMutationTransform): void {
  const filePath = normalizePath(transform.filePath ?? 'package.json');
  const current = vfs.read(filePath);
  const packageJson = current ? mutationEngine.parse(current, filePath) : {};
  const merged = packageJsonMerger.merge(packageJson, transform);
  const serialized = mutationEngine.serialize(merged);

  if (serialized !== (current ?? '')) {
    vfs.write(filePath, serialized);
  }
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
  const serialized = formatEnvLines(mergedLines);

  if (serialized !== current) {
    vfs.write(filePath, serialized);
  }
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

