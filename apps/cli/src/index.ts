#!/usr/bin/env node

declare const process: {
	argv: string[];
	exitCode?: number;
};

export const name = '@kiln/cli';
export const version = '0.0.0';

type CommandName = 'create' | 'add' | 'inspect' | 'doctor';

const commands: Record<CommandName, string> = {
	create: 'Scaffold a new kiln project.',
	add: 'Add a capability, adapter, or package to a kiln project.',
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

function runCommand(command: CommandName, options: { dryRun?: boolean }): void {
  console.log(`kiln ${command}${options.dryRun ? ' (dry-run)' : ''}`);
}

function main(argv: string[]): void {
  const flags = argv.filter(arg => arg.startsWith('--') || arg.startsWith('-'));
  const args = argv.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
  
  const [firstArg, secondArg] = args;
  
  const isHelpFlag = flags.includes('--help') || flags.includes('-h');
  const isVersionFlag = flags.includes('--version') || flags.includes('-v');
  const isDryRunFlag = flags.includes('--dry-run');

  if (!firstArg && isHelpFlag || (firstArg && isHelpFlag)) {
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

  if (firstArg in commands) {
    runCommand(firstArg as CommandName, { dryRun: isDryRunFlag });
		return;
	}

	console.error(`Unknown command: ${firstArg}`);
	console.error();
	printHelp();
	process.exitCode = 1;
}

main(process.argv.slice(2));
