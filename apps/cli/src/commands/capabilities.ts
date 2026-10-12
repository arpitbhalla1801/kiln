import { LockfileStore, OwnershipMetadataStore } from '@kiln-cli/project-model';
import { createCapabilityRuntime, type CapabilityDescription } from '@kiln-cli/runtime';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

type CapabilityEntry = CapabilityDescription & {
  installed: boolean;
  /** Version recorded in the lockfile when the capability was last added. */
  installedVersion?: string;
};

async function describeAll(cwd: string, allowUnverified?: boolean): Promise<CapabilityEntry[]> {
  // Built-ins are listable anywhere; plugins and installed state need a kiln project.
  const projectRoot = await resolveProjectRoot(cwd).catch(() => undefined);
  const rootPath = projectRoot ?? cwd;
  const runtime = createCapabilityRuntime({ allowUnverified });
  await runtime.loadPlugins(rootPath);
  const all = await runtime.describeCapabilities();
  const installed = projectRoot ? await readInstalled(projectRoot) : new Map<string, string | undefined>();

  return all
    .map((entry) => ({
      ...entry,
      installed: installed.has(entry.id),
      installedVersion: installed.get(entry.id),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Same sources `kiln inspect` uses: the lockfile, plus whoever owns files, dependencies or env vars. */
export async function readInstalled(rootPath: string): Promise<Map<string, string | undefined>> {
  const installed = new Map<string, string | undefined>();

  const lockCapabilities = (await LockfileStore.load(rootPath))?.snapshot?.capabilities ?? [];
  for (const entry of lockCapabilities) {
    installed.set(entry.id, entry.version);
  }

  if (await OwnershipMetadataStore.exists(rootPath)) {
    const ownership = await OwnershipMetadataStore.load(rootPath);
    for (const entry of [...ownership.files, ...ownership.dependencies, ...ownership.envVars]) {
      if (!installed.has(entry.ownerCapabilityId)) {
        installed.set(entry.ownerCapabilityId, undefined);
      }
    }
  }

  return installed;
}

function trustLabel(entry: CapabilityDescription): string {
  if (entry.source === 'builtin') {
    return 'builtin';
  }
  return entry.verified ? 'plugin, verified' : 'plugin, UNVERIFIED';
}

/** `kiln capabilities list` -- every capability kiln can add, with origin, trust and install state. */
export async function runCapabilitiesList(options: Pick<CliOptions, 'cwd' | 'json' | 'allowUnverified'>): Promise<void> {
  const entries = await describeAll(options.cwd, options.allowUnverified);

  if (options.json) {
    const summaries = entries.map((entry) => ({
      id: entry.id,
      name: entry.manifest.name,
      version: entry.manifest.version,
      description: entry.manifest.description,
      frameworks: entry.manifest.frameworks,
      source: entry.source,
      package: entry.package,
      verified: entry.verified,
      installed: entry.installed,
      installedVersion: entry.installedVersion,
    }));
    console.log(JSON.stringify(summaries, null, 2));
    return;
  }

  for (const entry of entries) {
    const mark = entry.installed ? '✓' : '✗';
    console.log(
      `${mark} ${entry.id.padEnd(12)} ${trustLabel(entry).padEnd(20)} ${entry.manifest.description}`
    );
  }
}

/** `kiln capabilities show <id>` -- the full manifest plus trust and install state. */
export async function runCapabilitiesShow(
  capabilityId: string,
  options: Pick<CliOptions, 'cwd' | 'json' | 'allowUnverified'>
): Promise<void> {
  const entries = await describeAll(options.cwd, options.allowUnverified);
  const entry = entries.find((candidate) => candidate.id === capabilityId);

  if (!entry) {
    throw new Error(
      `Unknown capability '${capabilityId}'. Available: ${entries.map((e) => e.id).join(', ')}`
    );
  }

  if (options.json) {
    const { id, source, package: pkg, verified, installed, installedVersion, manifestSha256, manifest } = entry;
    console.log(
      JSON.stringify(
        { id, source, package: pkg, verified, installed, installedVersion, manifestSha256, manifest },
        null,
        2
      )
    );
    return;
  }

  const { manifest } = entry;
  console.log(`${entry.id} ${manifest.version} (${trustLabel(entry)})`);
  console.log(manifest.description);
  console.log(
    `Installed: ${entry.installed ? `yes${entry.installedVersion ? ` (${entry.installedVersion})` : ''}` : 'no'}`
  );
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
