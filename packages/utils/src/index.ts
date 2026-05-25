export const name = '@kiln/utils';
import { existsSync } from "fs";
import { join } from "path";

export type PackageManger = 'bun' | 'yarn' | 'npm' | 'pnpm'

export function detectPackageManager(projectPath: string): PackageManger {
    if (existsSync(join(projectPath, 'bun.lock')) || existsSync(join(projectPath, 'bun.lockb'))) return 'bun'
    else if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    else if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
    else return 'npm';
}