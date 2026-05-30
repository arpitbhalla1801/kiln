export const name = '@kiln/utils';

import { existsSync, readFileSync } from "fs";
import { join } from "path";

export type PackageManger = 'bun' | 'yarn' | 'npm' | 'pnpm'

export type InstallState = {
    required:boolean,
    reason?:string
}

export type PackageJson = {
    dependencies?:Record<string,string>
    devDependencies?:Record<string,string>
}

export function detectPackageManager(projectPath: string): PackageManger {
    if (existsSync(join(projectPath, 'bun.lock')) || existsSync(join(projectPath, 'bun.lockb'))) return 'bun'
    else if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
    else if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
    else return 'npm';
}

function DependencyChanges(before:Record<string,string> = {},after:Record<string,string> = {}) : boolean{
    const beforeKeys = Object.keys(before)
    const afterKeys = Object.keys(after)

    if(beforeKeys.length !== afterKeys.length) return true


    for(const key of afterKeys){
        if(before[key] !== after[key]) return true
    }

    return false
}
export function detectDependencyChanges(before:PackageJson,after:PackageJson):InstallState{
    if(DependencyChanges(before.dependencies,after.dependencies)){
        return {required:true,reason:'Dependencies changed'}
    }

    if(DependencyChanges(before.devDependencies,after.devDependencies)){
        return {
            required:true,
            reason:'devDependencies changed'
        }
    }

    return {
        required:false
    }
}

export function resolveInstallState(projectPath:string,before:PackageJson):InstallState{
    const packageJsonPath = join(projectPath,'package.json')
    const current:PackageJson = JSON.parse(readFileSync(packageJsonPath,'utf-8'))
    return detectDependencyChanges(before,current)
}