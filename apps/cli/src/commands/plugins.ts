import { checkPluginPins, loadPlugins } from '@kiln/runtime';
import { PluginConfigStore } from '@kiln/project-model';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

/** `kiln plugins list` -- show every trust-config entry and whether it currently loads. */
export async function runPluginsList(options: Pick<CliOptions, 'cwd'>): Promise<void> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const config = await PluginConfigStore.load(rootPath);

  if (config.plugins.length === 0) {
    console.log('No plugins listed in kiln.plugins.json.');
    return;
  }

  const results = await loadPlugins(rootPath, config.plugins);

  for (const result of results) {
    const label = `${result.entry.package}@${result.entry.version}`;
    if (result.skipped) {
      console.log(`(skip) ${label} -- ${result.reason}`);
    } else {
      console.log(`(ok)   ${label} -- loads as capability '${result.capability?.id}'`);
    }
  }
}

/** `kiln plugins verify` -- report version-pin mismatches without loading anything. */
export async function runPluginsVerify(options: Pick<CliOptions, 'cwd'>): Promise<void> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const config = await PluginConfigStore.load(rootPath);

  if (config.plugins.length === 0) {
    console.log('No plugins listed in kiln.plugins.json.');
    return;
  }

  const results = await checkPluginPins(rootPath, config.plugins);
  const mismatches = results.filter((result) => !result.ok);

  for (const result of results) {
    const label = `${result.entry.package}@${result.entry.version}`;
    if (result.ok) {
      console.log(`(ok)        ${label}`);
    } else {
      console.log(`(mismatch)  ${label} -- ${result.reason}`);
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `${mismatches.length} plugin(s) have a version-pin mismatch. See output above.`
    );
  }
}
