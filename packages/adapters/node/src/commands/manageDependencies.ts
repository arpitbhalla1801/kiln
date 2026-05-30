import { detectPackageManager } from "@kiln/utils"

export async function addDependency(projectPath: string, dependencies: string[], dev: boolean = false): Promise<void> {
    const packageManager = detectPackageManager(projectPath)
    if (!packageManager) {
        throw new Error('No package Manager exists')
    }
    let result = null
    if (packageManager == 'bun') {
        const args = dev
            ? [packageManager, 'add', '--dev', ...dependencies]
            : [packageManager, 'add', ...dependencies]

        result = Bun.spawnSync(args, {
            cwd: projectPath,
            stdout: 'inherit',
            stderr: 'inherit'
        })
    }
    if (result && result.exitCode !== 0) {
        throw new Error('Error while adding the dependencies')
    }
    console.log('Dependencies added successfully')
}

export async function removeDependency(projectPath: string, dependencies: string[]): Promise<void> {
    const packageManager = detectPackageManager(projectPath)
    if (!packageManager) {
        throw new Error('No package Manager exists')
    }
    let result = null
    if (packageManager == 'bun') {
        result = Bun.spawnSync([packageManager, 'remove', ...dependencies], {
            cwd: projectPath,
            stdout: 'inherit',
            stderr: 'inherit'
        })
    }
    if (result && result.exitCode !== 0) {
        throw new Error('Error while removing the dependencies')
    }
    console.log('Dependencies removed successfully')
}