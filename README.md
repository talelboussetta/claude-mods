# claude-mods

Talel's mods for Claude Desktop, served as a local plugin marketplace called `talel-mods`.

| Mod | What it does |
|---|---|
| `workbench` | Four live backdrops that move on with every prompt: **chess** (a famous game, one move per prompt), **chalk** (a proof written one line at a time), **journey** (a mountain road), **blueprint** (a drawing built from your work log). A button bar above the prompt switches between them. Commands: `/backdrop chess \| chalk \| journey \| blueprint` and `/worklog`. |
| `drafting-table` | The older standalone Blueprint look with a work-log band. Superseded by `workbench`; don't install both (they share `/worklog`). |

## Install

The repo is private, so the machine needs GitHub access to `talelboussetta`. From Claude:

```
/plugin marketplace add talelboussetta/claude-mods
/plugin install workbench@talel-mods
```

Or from a local clone:

```powershell
git clone https://github.com/talelboussetta/claude-mods D:\dev\work\claude-mods
claude plugin marketplace add D:\dev\work\claude-mods
claude plugin install workbench@talel-mods --scope user
```

Restart Claude Desktop afterwards.

## Changing a mod

Edit the files here, bump `version` in the mod's `.claude-plugin/plugin.json`, then run
`claude plugin marketplace update talel-mods` and `claude plugin update workbench@talel-mods`.

`claude plugin validate` currently reports `"session.start" is not an event` on these mods. The same error
appears on Anthropic's own `theme-examples` plugin; the CLI validator is behind the Desktop runtime, and the
mods load fine.
