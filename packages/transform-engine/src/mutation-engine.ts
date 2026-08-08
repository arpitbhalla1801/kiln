import type { JsonAstMutation } from './mutation-types.js';

/** Structured JSON mutation engine with idempotent AST operations. */
export class StructuredMutationEngine {
  parse(content: string, filePath = 'json'): Record<string, unknown> {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('JSON root must be an object');
      }

      return cloneJson(parsed as Record<string, unknown>);
    } catch (error) {
      throw new Error(
        `Invalid JSON in '${filePath}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  serialize(document: Record<string, unknown>): string {
    return `${JSON.stringify(sortJsonKeys(document), null, 2)}\n`;
  }

  apply(document: Record<string, unknown>, mutation: JsonAstMutation): void {
    switch (mutation.type) {
      case 'set':
        this.applySet(document, mutation.path, mutation.value);
        return;
      case 'delete':
        this.applyDelete(document, mutation.path);
        return;
      case 'merge':
        this.applyMerge(document, mutation.path, mutation.value);
        return;
      default:
        throw new Error(`Unsupported JSON mutation type: ${(mutation as JsonAstMutation).type}`);
    }
  }

  applyAll(document: Record<string, unknown>, mutations: JsonAstMutation[]): void {
    for (const mutation of mutations) {
      this.apply(document, mutation);
    }
  }

  private applySet(document: Record<string, unknown>, path: string, value: unknown): void {
    const currentValue = getJsonPath(document, path);
    if (valuesEqual(currentValue, value)) {
      return;
    }

    setJsonPath(document, path, cloneJsonValue(value));
  }

  private applyDelete(document: Record<string, unknown>, path: string): void {
    if (getJsonPath(document, path) === undefined) {
      return;
    }

    deleteJsonPath(document, path);
  }

  private applyMerge(
    document: Record<string, unknown>,
    path: string,
    value: Record<string, unknown>
  ): void {
    const currentValue = getJsonPath(document, path);
    const currentObject =
      typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)
        ? (currentValue as Record<string, unknown>)
        : {};

    const merged = mergeJsonObjects(currentObject, value);
    if (valuesEqual(currentObject, merged)) {
      return;
    }

    setJsonPath(document, path, merged);
  }
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneJsonValue(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    return cloneJson(value);
  }

  return value;
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortJsonKeys(left)) === JSON.stringify(sortJsonKeys(right));
}

export function sortJsonKeys(value: unknown): unknown {
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

export function getJsonPath(target: Record<string, unknown>, jsonPath: string): unknown {
  const segments = jsonPath.split('.').filter(Boolean);
  let current: unknown = target;

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function setJsonPath(target: Record<string, unknown>, jsonPath: string, value: unknown): void {
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

export function deleteJsonPath(target: Record<string, unknown>, jsonPath: string): void {
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

export function mergeJsonObjects(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const existing = merged[key];

    if (
      typeof existing === 'object' &&
      existing !== null &&
      !Array.isArray(existing) &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      merged[key] = mergeJsonObjects(existing as Record<string, unknown>, value);
      continue;
    }

    merged[key] = cloneJsonValue(value);
  }

  return sortJsonKeys(merged) as Record<string, unknown>;
}

export function mergeStringRecords(
  target: Record<string, string>,
  source: Record<string, string>
): Record<string, string> {
  const merged = { ...target, ...source };
  return Object.fromEntries(
    Object.entries(merged).sort(([left], [right]) => left.localeCompare(right))
  );
}
