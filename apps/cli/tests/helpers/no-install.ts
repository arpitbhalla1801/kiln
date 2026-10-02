import { NodeAdapter } from '@kiln-cli/node-adapter';

// Import for its side effect. These tests assert on the files kiln writes, not on
// installed packages, and a real `bun add` costs minutes on Windows (#214). The business
// journeys keep covering the real install path.
NodeAdapter.prototype.installDependencies = async () => ({ exitCode: 0, stdout: '', stderr: '' });
