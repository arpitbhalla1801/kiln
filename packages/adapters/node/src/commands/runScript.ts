import { existsSync } from "fs";
import { installDependencies } from "./installDependencies";
import { detectPackageManager } from "@kiln/utils";
import { join } from "path";

export async function runScript(projectPath:string,script:string): Promise<void> {
    if(!existsSync(join(projectPath,'node_modules'))){
        console.log('Node_modules does not exist,installing dependenices...')
        await installDependencies(projectPath)
    }

    const packageManager = detectPackageManager(projectPath)

    const result = Bun.spawnSync([packageManager,'run',script],{
        cwd:projectPath,
        stdout:'inherit',
        stderr:'inherit'
    })

    if(result.exitCode !== 0){
        throw new Error(`Error encountered in running ${script} script`)
    }

    
}
