#!/usr/bin/env node

import { resolve } from 'node:path';
import pkg from '../package.json';
import { runAdd, parseEnvVariables } from './commands/add.js';
import { runCreate } from './commands/create.js';
import { runDoctor } from './commands/doctor.js';
import { runInspect } from './commands/inspect.js';
import { runRemove } from './commands/remove.js';
import { checkForUpdate } from './update-check.js';

declare const process: {
  argv: string[];
  cwd: () => string;
  exitCode?: number;
};

export const name = pkg.name;
export const version = pkg.version;

type CommandName = 'create' | 'add' | 'remove' | 'inspect' | 'doctor';

const commands: Record<CommandName, string> = {
  create: 'Scaffold a new kiln project.',
  add: 'Add a capability to a kiln project (env, auth).',
  remove: 'Remove a capability from a kiln project (env, auth).',
  inspect: 'Inspect the current kiln project.',
  doctor: 'Run environment checks for kiln.',
};

function printHelp(topic?: string): void {
  if (topic && topic in commands) {
    const command = topic as CommandName;
    console.log(`Usage: kiln ${command} [options]`);
    console.log();
    console.log(commands[command]);
    console.log();

    if (command === 'create') {
      console.log('Usage: kiln create <name>');
      console.log('Name must be npm-safe: lowercase letters, numbers, hyphens, underscores.');
    }

    if (command === 'add') {
      console.log('Usage: kiln add <capability>');
      console.log('Capabilities: env, auth');
      console.log('  kiln add env [--var KEY=value]');
      console.log('  kiln add auth');
    }

    if (command === 'remove') {
      console.log('Usage: kiln remove <capability>');
      console.log('Capabilities: env, auth');
      console.log('Deletes the files, dependencies, scripts, and env vars that capability owns.');
    }

    console.log();
    console.log('Options:');
    console.log('  --dry-run   Preview operations without touching the filesystem');
    return;
  }

  console.log('Usage: kiln <command> [options]');
  console.log();
  console.log('Commands:');
  for (const [command, description] of Object.entries(commands)) {
    console.log(`  ${command.padEnd(8)} ${description}`);
  }
  console.log();
  console.log('Global Options:');
  console.log('  --dry-run   Preview operations without touching the filesystem');
  console.log('  --help, -h  Show help');
  console.log('  --version, -v Show version');
}

function printVersion(): void {
  console.log(version);
}

async function main(argv: string[]): Promise<void> {
  const flags = argv.filter((arg) => arg.startsWith('--') || arg.startsWith('-'));
  const args = argv.filter((arg) => !arg.startsWith('--') && !arg.startsWith('-'));

  const [firstArg, secondArg, thirdArg] = args;

  const isHelpFlag = flags.includes('--help') || flags.includes('-h');
  const isVersionFlag = flags.includes('--version') || flags.includes('-v');
  const isDryRunFlag = flags.includes('--dry-run');

  const cliOptions = {
    dryRun: isDryRunFlag,
    cwd: process.cwd(),
  };

  if ((!firstArg && isHelpFlag) || (firstArg && isHelpFlag)) {
    printHelp(firstArg in commands ? firstArg : undefined);
    return;
  }

  if (isVersionFlag || firstArg === 'version') {
    printVersion();
    return;
  }

  if (!firstArg || firstArg === 'help') {
    if (secondArg && secondArg in commands) {
      printHelp(secondArg);
      return;
    }

    printHelp();
    return;
  }

  if (firstArg === 'create') {
    if (secondArg === undefined) {
      throw new Error('Project name is required. Usage: kiln create <name>');
    }
    const projectName = secondArg;
    const targetDir = resolve(cliOptions.cwd, projectName);
    await runCreate(targetDir, projectName);
    return;
  }

  if (firstArg === 'add') {
    const capabilityId = secondArg;
    if (!capabilityId) {
      throw new Error('Missing capability. Usage: kiln add <env|auth>');
    }

    const envVariables = capabilityId === 'env' ? parseEnvVariables(argv) : {};
    await runAdd(capabilityId, cliOptions, envVariables);
    return;
  }

  if (firstArg === 'remove') {
    const capabilityId = secondArg;
    if (!capabilityId) {
      throw new Error('Missing capability. Usage: kiln remove <env|auth>');
    }

    await runRemove(capabilityId, cliOptions);
    return;
  }

  if (firstArg === 'inspect') {
    await runInspect(cliOptions);
    return;
  }

  if (firstArg === 'doctor') {
    await runDoctor(cliOptions);
    return;
  }

  if (firstArg in commands) {
    throw new Error(`Command '${firstArg}' is not yet wired. Use kiln help.`);
  }

  console.error(`Unknown command: ${firstArg}`);
  console.error();
  printHelp();
  process.exitCode = 1;
}

main(process.argv.slice(2))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => checkForUpdate(version));
