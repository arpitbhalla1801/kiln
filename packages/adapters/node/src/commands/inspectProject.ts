import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { detectPackageManager, type PackageManger } from "@kiln/utils"

export type InspectProjectResult = {
    packageManager : PackageManger,
    projectType: string,
    version:string | null
}

export async function inspectProject(projectPath: string): Promise<InspectProjectResult> {
    const pckgPath = join(projectPath, 'package.json')
    if (!existsSync(pckgPath)) {
        throw new Error('No package.json present in the project')
    }

    const raw = await readFile(pckgPath, 'utf-8')
    const pckg = JSON.parse(raw)

    const deps = { ...pckg.dependencies, ...pckg.devDependencies }

    let projectType = 'node'

    if (deps['next']) projectType = 'nextjs'
    else if (deps['express']) projectType = 'express'

    const packageManager = detectPackageManager(projectPath)
    const workspaceRoot = join(projectPath,"../..")

    let version = null
    const kilnMetaPath = join(workspaceRoot, '.kiln', 'project.json')
    if (!existsSync(kilnMetaPath)) {
        console.log('Kiln Metadata does not exist')
    } else {
        const metaRaw = await readFile(kilnMetaPath,'utf-8')
        const kilnMeta = JSON.parse(metaRaw)
        version = kilnMeta.kilnVersion
    }
    
    return {
        packageManager,
        projectType,
        version
    }
    
}
