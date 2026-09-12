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
