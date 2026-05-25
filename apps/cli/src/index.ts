#!/usr/bin/env bun

import { createNextAppWithBun, inspectProject, installDependencies, runScript } from '@kiln/node-adapter';
import { resolve } from 'path';
import { join } from 'path';
import {InspectProjectResult} from '@kiln/node-adapter'

const ALLOWED_SCRIPTS = ['dev', 'build', 'lint'];

const args = process.argv.slice(2);
const projectPath = join(resolve(process.cwd()))
// kiln add app {app_name}
if (args[0] === 'add' && args[1] === 'app' && args[2]) {
  const appName = args[2];
  const projectRoot = resolve(process.cwd());

  createNextAppWithBun({ appName, projectRoot })
    .then(() => process.exit(0))
    //@ts-ignore
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
else if (args[0] == 'inspect') {
  inspectProject(projectPath)
    .then((state:InspectProjectResult) => {
      console.log(`Package Manager : ${state.packageManager}`)
      console.log(`Project type : ${state.projectType}`)
      console.log(`Kiln Version : ${state.version}`)
    })
    .catch((err) => {
      console.error('Inspect error ', err.message)
      process.exit(1)
    })
}

else if (args[0] == 'install') {
  installDependencies(projectPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error in dependencies install', err.message)
      process.exit(1)
    })
}

else if (args[0] == 'run' && args[1] && ALLOWED_SCRIPTS.includes(args[1])){
  runScript(projectPath,args[1])
  .then(()=>{
    process.exit(0)
  })
  .catch((err)=>{
    console.error('Error in running the script',err.message)
    process.exit(1)
  })
}
else {
  console.log('Usage: kiln add app <app-name> | kiln install | kiln inspect | kiln run {dev,build,lint}' );
  process.exit(1);
}