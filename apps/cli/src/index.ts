#!/usr/bin/env bun

import { createNextAppWithBun } from '@kiln/node-adapter';
import { resolve } from 'path';

const args = process.argv.slice(2);

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
} else {
  console.log('Usage: kiln add app <app-name>');
  process.exit(1);
}