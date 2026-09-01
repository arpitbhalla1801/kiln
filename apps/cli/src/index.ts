#!/usr/bin/env node

import { resolve } from 'node:path';
import { runAdd, parseEnvVariables } from './commands/add.js';
import { runCreate } from './commands/create.js';
import { runDoctor } from './commands/doctor.js';
import { runInspect } from './commands/inspect.js';

declare const process: {
  argv: string[];
  cwd: () => string;
  exitCode?: number;
};

export const name = '@kiln/cli';
export const version = '0.0.0';

type CommandName = 'create' | 'add' | 'inspect' | 'doctor';

const commands: Record<CommandName, string> = {
  create: 'Scaffold a new kiln project.',
  add: 'Add a capability to a kiln project (env, auth).',
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

    if (command === 'add') {
      console.log('Usage: kiln add <capability>');
      console.log('Capabilities: env, auth');
      console.log('  kiln add env [--var KEY=value]');
      console.log('  kiln add auth');
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
    const projectName = secondArg ?? 'my-kiln-app';
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

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
