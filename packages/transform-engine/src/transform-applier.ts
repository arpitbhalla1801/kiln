import type {
  EnvMutationTransform,
  EnvVariableDefinition,
  FileDeleteTransform,
  FilePatchTransform,
  JsonMutationTransform,
  PackageJsonMutationTransform,
  TransformPipeline,
  TypedTransform,
} from './transform-types.js';
import type { VirtualFilesystem } from './vfs.js';
import { detectJsonIndent, StructuredMutationEngine } from './mutation-engine.js';
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
      case 'file-delete':
        applyFileDelete(vfs, transform);
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

function applyFileDelete(vfs: VirtualFilesystem, transform: FileDeleteTransform): void {
  const filePath = normalizePath(transform.filePath);
  if (vfs.exists(filePath)) {
    vfs.delete(filePath);
  }
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
  const serialized = mutationEngine.serialize(merged, {
    preserveKeyOrder: true,
    indent: detectJsonIndent(current),
  });

  if (serialized !== (current ?? '')) {
    vfs.write(filePath, serialized);
  }
}

function applyEnvMutation(vfs: VirtualFilesystem, transform: EnvMutationTransform): void {
  const filePath = normalizePath(transform.filePath);
  const current = vfs.read(filePath) ?? '';
  const entries = parseEnvEntries(current);
  const varEntries = new Map(
    entries.filter((entry): entry is EnvVarEntry => entry.type === 'var').map((entry) => [entry.key, entry])
  );

  const sectionHeader = transform.section ? `# --- ${transform.section} ---` : undefined;
  let sectionHeaderPresent = sectionHeader
    ? entries.some((entry) => entry.type === 'raw' && entry.text.trim() === sectionHeader)
    : true;

  for (const [key, definition] of Object.entries(transform.variables)) {
    const normalized = normalizeEnvDefinition(definition);
    const existing = varEntries.get(key);
    const value = normalized.value ?? normalized.example ?? existing?.value;

    if (/[\r\n]/.test(key) || (value !== undefined && /[\r\n]/.test(value))) {
      throw new Error(
        `Refusing to write env var '${key}': keys and values cannot contain newlines (would inject untracked lines into ${filePath}).`
      );
    }

    if (existing) {
      if (!transform.preserveExistingValues) {
        existing.value = value ?? existing.value;
      }
      continue;
    }

    if (sectionHeader && !sectionHeaderPresent) {
      entries.push({ type: 'raw', text: sectionHeader });
      sectionHeaderPresent = true;
    }

    if (normalized.required) {
      entries.push({ type: 'raw', text: '# required' });
    }

    const created: EnvVarEntry = { type: 'var', key, value: value ?? '' };
    varEntries.set(key, created);
    entries.push(created);
  }

  const removeKeys = new Set(transform.removeVariables ?? []);
  const remaining = removeKeys.size > 0
    ? entries.filter((entry) => entry.type !== 'var' || !removeKeys.has(entry.key))
    : entries;

  const serialized = formatEnvEntries(remaining);

  if (serialized !== current.replace(/\r\n/g, '\n')) {
    vfs.write(filePath, serialized);
  }
}

interface EnvVarEntry {
  type: 'var';
  key: string;
  value: string;
}

interface EnvRawEntry {
  type: 'raw';
  text: string;
}

type EnvEntry = EnvVarEntry | EnvRawEntry;

function parseEnvEntries(content: string): EnvEntry[] {
  if (content.length === 0) {
    return [];
  }

  // Normalize CRLF to LF so files checked out with Windows-style line
  // endings (e.g. via git's core.autocrlf) don't look "changed" on every
  // run just because kiln always serializes with plain '\n'.
  const rawLines = content.replace(/\r\n/g, '\n').split('\n');
  // A trailing newline produces a final empty split element; drop it so a
  // single trailing newline round-trips without accumulating blank lines.
  if (rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }

  return rawLines.map((rawLine): EnvEntry => {
    const line = rawLine.trim();
    const separatorIndex = line.indexOf('=');

    if (!line || line.startsWith('#') || separatorIndex === -1) {
      return { type: 'raw', text: rawLine };
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    return { type: 'var', key, value };
  });
}

function formatEnvEntries(entries: EnvEntry[]): string {
  if (entries.length === 0) {
    return '';
  }

  const rendered = entries.map((entry) =>
    entry.type === 'var' ? `${entry.key}=${entry.value}` : entry.text
  );

  return `${rendered.join('\n')}\n`;
}

function normalizeEnvDefinition(
  definition: string | EnvVariableDefinition
): EnvVariableDefinition {
  if (typeof definition === 'string') {
    return { example: definition };
  }

  return definition;
}

