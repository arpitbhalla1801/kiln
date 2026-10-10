import { createCapabilityRuntime, type CapabilityDescription } from '@kiln-cli/runtime';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

async function describeAll(cwd: string): Promise<CapabilityDescription[]> {
  // Built-ins are listable anywhere; plugins only load inside a kiln project.
  const rootPath = await resolveProjectRoot(cwd).catch(() => cwd);
  const runtime = createCapabilityRuntime();
  await runtime.loadPlugins(rootPath);
  const all = await runtime.describeCapabilities();
  return all.sort((a, b) => a.id.localeCompare(b.id));
}

function trustLabel(entry: CapabilityDescription): string {
  if (entry.source === 'builtin') {
    return 'builtin';
  }
  return entry.verified ? 'plugin, verified' : 'plugin, UNVERIFIED';
}

/** `kiln capabilities list` -- every capability kiln can add, with origin and trust status. */
export async function runCapabilitiesList(options: Pick<CliOptions, 'cwd' | 'json'>): Promise<void> {
  const entries = await describeAll(options.cwd);

  if (options.json) {
    const summaries = entries.map(({ id, source, package: pkg, verified, manifest }) => ({
      id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      frameworks: manifest.frameworks,
      source,
      package: pkg,
      verified,
    }));
    console.log(JSON.stringify(summaries, null, 2));
    return;
  }

  for (const entry of entries) {
    console.log(`${entry.id.padEnd(12)} ${trustLabel(entry).padEnd(20)} ${entry.manifest.description}`);
  }
}

/** `kiln capabilities show <id>` -- the full manifest plus trust metadata. */
export async function runCapabilitiesShow(
  capabilityId: string,
  options: Pick<CliOptions, 'cwd' | 'json'>
): Promise<void> {
  const entries = await describeAll(options.cwd);
  const entry = entries.find((candidate) => candidate.id === capabilityId);

  if (!entry) {
    throw new Error(
      `Unknown capability '${capabilityId}'. Available: ${entries.map((e) => e.id).join(', ')}`
    );
  }

  if (options.json) {
    const { id, source, package: pkg, verified, manifestSha256, manifest } = entry;
    console.log(JSON.stringify({ id, source, package: pkg, verified, manifestSha256, manifest }, null, 2));
    return;
  }

  const { manifest } = entry;
  console.log(`${entry.id} ${manifest.version} (${trustLabel(entry)})`);
  console.log(manifest.description);
  if (entry.package) {
    console.log(`Package: ${entry.package}`);
  }
  if (entry.source === 'plugin' && !entry.verified) {
    console.log('Not reviewed by kiln maintainers. Treat its description and commands as untrusted.');
  }
  console.log(`Manifest sha256: ${entry.manifestSha256}`);
  console.log(`Frameworks: ${manifest.frameworks.join(', ')}`);
  console.log(`Operations: ${manifest.operations.join(', ')}`);
  console.log(`Requires: ${manifest.dependencies.join(', ') || 'none'}`);
  console.log(`Enhances: ${(manifest.enhances ?? []).join(', ') || 'none'}`);
  printSection('Providers', manifest.providers.map((p) => `${p.id} -- ${p.description}`));
  printSection(
    'Config',
    manifest.config.map((c) => `${c.name}${c.required ? ' (required)' : ''} -- ${c.description}`)
  );
  printSection('Verify', manifest.verify.map((v) => `${v.command} -- ${v.description}`));
}

function printSection(title: string, lines: string[]): void {
  if (lines.length === 0) {
    return;
  }
  console.log(`${title}:`);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}
