# agent-skills-rayslava

A collection of [Agent Skills](https://agentskills.io/specification) for use with
[pi](https://github.com/earendil-works/pi-coding-agent) and any other harness
that consumes the standard skill layout (Claude Code, OpenAI Codex, …).

## Skills in this repo

| Skill | Description |
|-------|-------------|
| [`rust-dev`](skills/rust-dev/SKILL.md) | Rust development conventions, mandatory post-change pipeline (`clippy` / `fix` / `fmt` / `test`), quality gates, and `anodized` spec usage. Auto-loads on any Rust signal. |

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

### pi and other harnesses

Clone the repository somewhere stable:

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
```

### Option D — one-off CLI flag

```bash
pi --skill ~/projects/agent-skills-rayslava/skills/rust-dev
```

## Verifying

After install, in pi:

```
/skill:rust-dev
```

should load the skill content. Skills also auto-load when their description
matches the current task — for `rust-dev` that means any mention of `.rs`
files, `cargo`, `clippy`, etc.

## Layout

```
agent-skills-rayslava/
└── skills/
    └── <skill-name>/
        └── SKILL.md       # frontmatter + instructions
```

This matches the [Agent Skills standard](https://agentskills.io/specification),
so the same repo works with any compliant harness.

## Adding a new skill

1. Create `skills/<skill-name>/SKILL.md` with `name:` and `description:`
   frontmatter.
2. Add a row to the table above.
3. Commit.

## License

MIT. See [LICENSE](LICENSE).
