# agent-skills

A collection of [Agent Skills](https://agentskills.io/specification) for use with
[pi](https://github.com/earendil-works/pi-coding-agent) and any other harness
that consumes the standard skill layout (Claude Code, OpenAI Codex, …).

## Skills in this repo

| Skill | Description |
|-------|-------------|
| [`rust-dev`](skills/rust-dev/SKILL.md) | Rust development conventions, mandatory post-change pipeline (`clippy` / `fix` / `fmt` / `test`), quality gates, and `anodized` spec usage. Auto-loads on any Rust signal. |

## Install

Clone the repository somewhere stable:

```bash
git clone https://github.com/rayslava/agent-skills.git ~/projects/agent-skills
```

Then make pi aware of the `skills/` directory.

### Option A — global (all projects)

Add to `~/.pi/settings.json`:

```json
{
  "skills": ["~/projects/agent-skills/skills"]
}
```

### Option B — per project

Add to `<project>/.pi/settings.json`:

```json
{
  "skills": ["~/projects/agent-skills/skills"]
}
```

### Option C — symlink into the discovery path

If you don't want to touch settings, symlink individual skills into a directory
pi already scans (`~/.agents/skills/` or `~/.pi/agent/skills/`):

```bash
ln -s ~/projects/agent-skills/skills/rust-dev ~/.agents/skills/rust-dev
```

### Option D — one-off CLI flag

```bash
pi --skill ~/projects/agent-skills/skills/rust-dev
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
agent-skills/
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
