import { detectPackageManager } from "@kiln/utils";

export async function installDependencies(projectPath:string):Promise<void>{
    const packageManager = detectPackageManager(projectPath)

    if(!packageManager){
        console.log('No package Manager found')
        process.exit(1)
    }

    const result = Bun.spawnSync([packageManager,'install'],{
        cwd:projectPath,
        stdout:'inherit',
        stderr:'inherit'
    })

    if(result.exitCode !== 0){
        throw new Error("Error while installing dependencies")
        
    }

    console.log("Dependencies installed")
}
