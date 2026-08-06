# agent-skills-rayslava

A collection of [Agent Skills](https://agentskills.io/specification) for use with
[pi](https://github.com/earendil-works/pi-coding-agent) and any other harness
that consumes the standard skill layout (Claude Code, OpenAI Codex, …).

## Skills in this repo

| Skill | Description |
|-------|-------------|
| [`rust-dev`](plugins/rust-dev/skills/rust-dev/SKILL.md) | Rust development conventions, mandatory post-change pipeline (`clippy` / `fix` / `fmt` / `test`), quality gates, and `anodized` spec usage. Auto-loads on any Rust signal. |
| [`go-dev`](plugins/go-dev/skills/go-dev/SKILL.md) | Go development conventions and mandatory post-change pipeline (fmt / mod tidy / vet / test). Auto-loads on any Go signal. |
| [`github-pr-write`](plugins/github-pr-write/skills/github-pr-write/SKILL.md) | Create, edit, and respond to GitHub Pull Requests via the `gh` CLI — open/edit a PR, reply to and resolve review threads, post comments. Read-modify-write body edits; confirms before every write. |

## pi extensions in this repo

| Command | Description |
|---------|-------------|
| [`/thinking`](extensions/thinking.ts) | Switch the model's thinking effort from the console. `/thinking` opens a picker (current level marked); `/thinking <level>` sets it directly. Levels: `off` / `minimal` / `low` / `medium` / `high` / `xhigh` (prefixes and shorthands like `max`, `med`, `none` accepted). Clamp-aware for non-reasoning models. |

## Install

### Claude Code — marketplace

The repo ships a single-plugin marketplace via `.claude-plugin/marketplace.json`.

**Local install** (no GitHub push needed):

```
/plugin marketplace add ~/projects/agent-skills-rayslava
/plugin install rust-dev@agent-skills-rayslava
```

**Remote install:**

```
/plugin marketplace add rayslava/agent-skills-rayslava
/plugin install rust-dev@agent-skills-rayslava
```

Update later with `/plugin marketplace update agent-skills-rayslava`. Validate
before install with `/plugin validate ~/projects/agent-skills-rayslava`.

Claude Code copies the plugin to its versioned cache at `~/.claude/plugins/cache/`,
so source edits don't auto-propagate — run `/plugin marketplace update` after
changes.

### pi — install as a package (skills + extensions)

The repo is a [pi package](https://github.com/earendil-works/pi-coding-agent/blob/main/docs/packages.md):
its `package.json` `pi` manifest exposes `./extensions` (the `/thinking` command)
and `./skills` (rust-dev, go-dev). Installing it wires up **both** at once.

```bash
# remote (pinned ref recommended)
pi install git:github.com/rayslava/agent-skills-rayslava

# or from a local clone (not copied — tracks your working tree live)
git clone https://github.com/rayslava/agent-skills-rayslava.git ~/projects/agent-skills-rayslava
pi install ~/projects/agent-skills-rayslava
```

Use `-l` to write to project settings (`.pi/settings.json`) instead of user
settings. Manage with `pi list`, `pi update`, `pi remove`. After install,
`/reload` (or restart) and the `/thinking` command + rust-dev skill are live.

### pi — skills only (other harnesses)

If you only want the skills (no extensions), clone the repo and point pi at the
`skills/` directory directly.

```bash
git clone https://github.com/rayslava/agent-skills-rayslava.git ~/projects/agent-skills-rayslava
```

Then make pi aware of the `skills/` directory.

### Option A — global (all projects)

Add to `~/.pi/settings.json`:

```json
{
  "skills": ["~/projects/agent-skills-rayslava/skills"]
}
```

### Option B — per project

Add to `<project>/.pi/settings.json`:

```json
{
  "skills": ["~/projects/agent-skills-rayslava/skills"]
}
```

### Option C — symlink into the discovery path

If you don't want to touch settings, symlink individual skills into a directory
pi already scans (`~/.agents/skills/` or `~/.pi/agent/skills/`):

```bash
ln -s ~/projects/agent-skills-rayslava/skills/rust-dev ~/.agents/skills/rust-dev
ln -s ~/projects/agent-skills-rayslava/plugins/go-dev/skills/go-dev ~/.agents/skills/go-dev
```

### Option D — one-off CLI flag

```bash
pi --skill ~/projects/agent-skills-rayslava/plugins/rust-dev/skills/rust-dev
pi --skill ~/projects/agent-skills-rayslava/plugins/go-dev/skills/go-dev
```

## Verifying

After install, in pi:

```
/skill:rust-dev
/skill:go-dev
```

should load the skill content. Skills also auto-load when their description
matches the current task — `rust-dev` recognizes `.rs` files, `cargo`, and
`clippy`; `go-dev` recognizes `.go` files, `go.mod`, `go.sum`, `go.work`,
`go test`, `gofmt`, and goroutines.

## Layout

```
agent-skills-rayslava/
├── package.json           # pi-package manifest (extensions + skills)
├── extensions/
│   └── thinking.ts        # /thinking command
└── skills/
    └── <skill-name>/
        └── SKILL.md   # frontmatter + instructions
```

The `skills/` layout matches the [Agent Skills standard](https://agentskills.io/specification),
so the same repo works with any compliant harness; the `package.json` `pi`
manifest additionally lets pi load the extensions.

## Adding a new skill

1. Create `skills/<skill-name>/SKILL.md` with `name:` and `description:`
   frontmatter.
2. Add a row to the table above.
3. Commit.

## License

MIT. See [LICENSE](LICENSE).
