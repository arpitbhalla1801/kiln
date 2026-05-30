export const name = '@kiln/node-adapter';
export { createNextAppWithBun } from './commands/createNextApp';
export { inspectProject } from './commands/inspectProject';
export { installDependencies } from './commands/installDependencies';
export { runScript } from './commands/runScript';
export {InspectProjectResult} from './commands/inspectProject'
export {addDependency,removeDependency} from './commands/manageDependencies'