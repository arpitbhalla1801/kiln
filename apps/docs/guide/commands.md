# Commands

| Command | Description |
|---------|-------------|
| `kiln init <name>` | Scaffold a new Next.js + TypeScript project |
| `kiln add env [--var KEY=value]` | Add environment variable capability |
| `kiln add auth [--provider <name>] [--var KEY=value]` | Add auth capability (next-auth) |
| `kiln add <capability>` | Add any registered capability, including third-party plugins |
| `kiln plugins list` | List installed plugin capabilities |
| `kiln plugins verify` | Verify installed plugin version pins |
| `kiln inspect` | Inspect project metadata and ownership |
| `kiln doctor` | Run environment and project health checks |

Global flags: `--dry-run`, `--help`, `--version`

See [Capabilities](/capabilities/overview) for what each capability scaffolds, and
[Plugins](/capabilities/plugins) for writing your own.
