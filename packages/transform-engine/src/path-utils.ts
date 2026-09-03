/** Normalize file paths while preserving absolute paths. */
export function normalizePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/');

  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  return normalized.replace(/^\/+/, '');
}
