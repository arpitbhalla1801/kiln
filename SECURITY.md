# Security Policy

## Supported Versions

Only the latest published version of `@kiln-cli/kiln` on npm receives security fixes. There is no long-term support branch at this stage of the project.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use [GitHub's private vulnerability reporting](https://github.com/arpitbhalla1801/kiln/security/advisories/new) for this repository (Security tab → "Report a vulnerability"). This opens a private advisory visible only to the maintainer until a fix is ready.

If you're unable to use that, email the maintainer directly (see the profile on the [arpitbhalla1801](https://github.com/arpitbhalla1801) GitHub account) with:

- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal repro is ideal)
- Any suggested fix, if you have one

## What to Expect

- Acknowledgement within a few days.
- A fix or mitigation plan communicated back through the same private channel before any public disclosure.
- Credit in the fix's release notes, unless you'd prefer to stay anonymous.

## Scope

Kiln scaffolds and mutates files in projects you run it against, and shells out to your package manager to install dependencies. Vulnerability reports involving arbitrary file write outside the target project, command injection via CLI arguments, or ownership-tracking integrity bypasses (letting one capability silently corrupt another's state) are all in scope and taken seriously.

### Third-party capability plugins

Kiln 2.0 can load third-party "capability" plugins (see `docs/plugin-architecture.md`). Be clear-eyed about what that means:

- **No sandbox.** A loaded plugin's `planAdd()` runs in-process, with the exact same filesystem-write, dependency-install, and shared-`OwnershipTracker` privileges as a built-in capability (`env`/`auth`/`db`). There is no VM, worker, or permission boundary between plugin code and the rest of kiln — a plugin is exactly as trusted as kiln's own first-party code once it's loaded.
- **Loaded only by explicit, pinned opt-in.** A plugin is only ever loaded if the project owner lists it in `kiln.plugins.json` with an exact version pin, and only if that exact package/version is already a direct dependency in the project's own `package.json`. There is no naming-convention auto-discovery — nothing is loaded just because it happens to be installed or named a certain way.
- **A broken or hostile plugin is isolated at the loading layer, not sandboxed at runtime.** kiln validates a plugin's trust config, version pin, SDK compatibility, and manifest shape before ever handing it control, and any failure there is a skip with a logged reason rather than a crash — but once a plugin passes those checks and its `planAdd()` runs, it has the same reach into your project as any built-in capability.
- **Shared ownership state is the one structural guard.** Every capability, first-party or plugin, registers its file/dependency/script/env-var claims through the same `OwnershipTracker`. A plugin attempting to claim a resource another capability already owns is rejected with a conflict error by `OwnershipTracker.register`/`tryRegister`, the same as if two built-ins collided — this is enforced structurally, not by trusting the plugin to behave.

If you're evaluating whether to trust a plugin, treat it as you would any other code you're about to run with full access to your project and machine — because that is exactly what it is.
