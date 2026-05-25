# kiln

## Adapter contract implementation

The Node adapter now covers the project-state inspection flow described in the
issue checklist.

### Package manager integration

Kiln detects the package manager for the target project by checking lockfiles in
the project directory:

- `bun.lock` or `bun.lockb` -> `bun`
- `pnpm-lock.yaml` -> `pnpm`
- `yarn.lock` -> `yarn`
- fallback -> `npm`

### Dependency install

`kiln install` installs dependencies in the current project directory using the
detected package manager. Failed installs throw an error, allowing the CLI to
exit with a failure status instead of reporting success.

### Script execution

`kiln run <script>` supports the allowed project scripts:

- `dev`
- `build`
- `lint`

If `node_modules` is missing, Kiln installs dependencies before running the
script. Script failures are surfaced as CLI errors.

### Filesystem expectations

Kiln commands are run from the actual app directory, for example:

```txt
workspace-root/apps/my-app
```

During inspection, Kiln reads the app's `package.json` from the app directory,
then walks two levels up to locate workspace metadata:

```txt
workspace-root/.kiln/project.json
```

This lets `kiln inspect` report project state for an app while still reading
Kiln metadata from the workspace root.

### Inspect project state

`kiln inspect` reports:

- detected package manager
- detected project type, such as `nextjs`, `express`, or `node`
- Kiln version from workspace-root `.kiln/project.json`, when present
