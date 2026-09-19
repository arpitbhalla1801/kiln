#!/usr/bin/env node

import { resolve } from 'node:path';
import pkg from '../package.json';
import { runAdd, parseEnvVariables, parseProviders } from './commands/add.js';
import { runCreate } from './commands/create.js';
import { runDbMigrate } from './commands/db-migrate.js';
import { runDoctor } from './commands/doctor.js';
import { runEnvRemove } from './commands/env-remove.js';
import { runInitPlugin } from './commands/init-plugin.js';
import { runInspect } from './commands/inspect.js';
import { runPluginsList, runPluginsVerify } from './commands/plugins.js';
import { runRemove } from './commands/remove.js';
import { checkForUpdate } from './update-check.js';

declare const process: {
  argv: string[];
  cwd: () => string;
  exitCode?: number;
};

export const name = pkg.name;
export const version = pkg.version;

type CommandName = 'create' | 'add' | 'remove' | 'env' | 'db' | 'inspect' | 'doctor' | 'init-plugin' | 'plugins';

const commands: Record<CommandName, string> = {
  create: 'Scaffold a new kiln project.',
  add: 'Add a capability to a kiln project (env, auth, db).',
  remove: 'Remove a capability from a kiln project (env, auth, db).',
  env: 'Manage individual environment variables.',
  db: 'Run database operations with the project env loaded.',
  inspect: 'Inspect the current kiln project.',
  doctor: 'Run environment checks for kiln.',
  'init-plugin': 'Scaffold a new third-party capability plugin package.',
  plugins: 'List or verify third-party plugins from kiln.plugins.json.',
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
      console.log('Capabilities: env, auth, db');
      console.log('  kiln add env [--var KEY=value]');
      console.log('  kiln add auth [--provider github|google|credentials] [--var KEY=value]');
      console.log('  kiln add db');
    }

    if (command === 'remove') {
      console.log('Usage: kiln remove <capability>');
      console.log('Capabilities: env, auth, db');
      console.log('Deletes the files, dependencies, scripts, and env vars that capability owns.');
    }

    if (command === 'env') {
      console.log('Usage: kiln env remove <NAME> [<NAME>...]');
      console.log('Removes the given variables from .env.local and .env.example.');
    }

    if (command === 'db') {
      console.log('Usage: kiln db migrate [-- <prisma migrate dev args>]');
      console.log('Runs `prisma migrate dev` with .env.local loaded into the environment.');
    }

    if (command === 'init-plugin') {
      console.log('Usage: kiln init-plugin <name>');
      console.log(
        'Scaffolds a kiln-capability-<name> package wired against @kiln/capability-sdk.'
      );
    }

    if (command === 'plugins') {
      console.log('Usage: kiln plugins <list|verify>');
      console.log('  kiln plugins list    Show each kiln.plugins.json entry and whether it loads.');
      console.log(
        '  kiln plugins verify  Report version-pin mismatches without loading anything.'
      );
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

  if (isHelpFlag) {
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
    await runCreate(targetDir, projectName, cliOptions.dryRun);
    return;
  }

  if (firstArg === 'add') {
    const capabilityId = secondArg;
    if (!capabilityId) {
      throw new Error('Missing capability. Usage: kiln add <env|auth>');
    }

    const envVariables = parseEnvVariables(argv);
    const providers = capabilityId === 'auth' ? parseProviders(argv) : [];
    await runAdd(capabilityId, cliOptions, envVariables, providers);
    return;
  }

  if (firstArg === 'db') {
    if (secondArg !== 'migrate') {
      throw new Error(`Unknown 'db' subcommand '${secondArg}'. Usage: kiln db migrate [-- <prisma migrate dev args>]`);
    }
    const migrateIndex = argv.indexOf('migrate');
    const extraArgs = argv.slice(migrateIndex + 1).filter((arg) => arg !== '--dry-run');
    await runDbMigrate(extraArgs, cliOptions);
    return;
  }

  if (firstArg === 'env') {
    if (secondArg !== 'remove') {
      throw new Error(`Unknown 'env' subcommand '${secondArg}'. Usage: kiln env remove <NAME> [<NAME>...]`);
    }
    await runEnvRemove(args.slice(2), cliOptions);
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

  if (firstArg === 'init-plugin') {
    if (secondArg === undefined) {
      throw new Error('Plugin name is required. Usage: kiln init-plugin <name>');
    }
    await runInitPlugin(cliOptions.cwd, secondArg, cliOptions.dryRun);
    return;
  }

  if (firstArg === 'plugins') {
    if (secondArg === 'verify') {
      await runPluginsVerify(cliOptions);
      return;
    }

    if (secondArg === 'list' || secondArg === undefined) {
      await runPluginsList(cliOptions);
      return;
    }

    throw new Error(`Unknown 'plugins' subcommand '${secondArg}'. Usage: kiln plugins <list|verify>`);
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
