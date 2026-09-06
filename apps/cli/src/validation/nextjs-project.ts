import { access } from 'node:fs/promises';
import { join } from 'node:path';

export async function expectsNextJsProject(rootPath: string): Promise<boolean> {
  const candidates = ['app', join('src', 'app'), 'pages', join('src', 'pages')];

  for (const relativePath of candidates) {
    if (await pathExists(join(rootPath, relativePath))) {
      return true;
    }
  }

  return false;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
