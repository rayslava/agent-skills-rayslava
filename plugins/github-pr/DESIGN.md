# github-pr — design

A reusable **skill** that lets a coding agent read (and later lightly act on)
GitHub Pull Requests and render them as clean, consistent markdown — using the
tools every harness already has: the **Bash tool + `gh` CLI**, with `gh`'s
built-in `--jq` / `--template` doing the rendering.

## Reframe (from review)

Two facts settled the form factor:

1. **pi has no MCP** (intentionally — `docs/usage.md`). So MCP can't be the
   shared mechanism; pi can't consume it natively.
2. Real Claude Code session logs show agents already accessed PRs fine with
   `gh pr view` / `gh api` / `gh api graphql` through the **Bash tool**. The only
   recurring weakness was **re-improvising the markdown render** each call
   (fragile inline python one-liners).

So the gap is *not* a new tool transport — both harnesses already have Bash +
`gh`. The gap is a **consistent rendering recipe**. A skill closes it with zero
new runtime.

## Form factor: skill + `gh --jq`, no script

- `SKILL.md` — encodes *when* to use each recipe and the **canonical output
  format**, so rendering is consistent instead of reinvented.
- **Rendering engine: `gh`'s built-in `--jq` and `--template`.** No Python, no
  Node, no bundled script, no MCP server. `gh` ships an embedded jq (gojq), so
  `jq` need not even be installed separately — though plain `jq` is used when
  piping between commands.
- Loads natively in **both pi and Claude Code** (standard Agent Skills layout),
  plus any harness with a shell.

Dropped from the earlier draft: the Python renderer script and the MCP server.

## Recipes (need → command)

All read-only. `R=owner/repo` resolved via `gh repo view --json nameWithOwner -q .nameWithOwner`.

| Need | Command |
|------|---------|
| Header line | `gh pr view N --json number,title,state,isDraft,author,baseRefName,headRefName,mergeable,reviewDecision --template '...'` |
| Body | `gh pr view N --json body -q .body` |
| Checks table | `gh pr view N --json statusCheckRollup -q '.statusCheckRollup[] | "\(.conclusion // .state)\t\(.name // .workflowName)"'` |
| Inline diff comments | `gh api repos/$R/pulls/N/comments --paginate -q '.[] | ...'` (has `path`,`line`,`user`,`body`) |
| Discussion comments | `gh api repos/$R/issues/N/comments --paginate -q '.[] | ...'` |
| **Thread resolution state** | `gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){reviewThreads(first:100){nodes{isResolved path line comments(first:50){nodes{author{login} body createdAt}}}}}}}' -q '...'` |
| CI failing job log tail | `gh pr checks N` then `gh api repos/$R/actions/jobs/<id>/logs -q ...` |
| PR list | `gh pr list --json number,title,author,state,url --template '...'` |

Resolution state is **GraphQL-only** (REST can't return `isResolved`); the
skill ships the exact query so the agent doesn't reconstruct it each time.

## Canonical output (what the skill tells the agent to produce)

```markdown
# PR #374 — <title>
OPEN (draft) · @author · base `main` ← head `feat/...`
mergeable: MERGEABLE · review: CHANGES_REQUESTED

## Description
<body>

## Checks
| state | name |
|-------|------|
| ✅ | build |
| ❌ | lint |

## Review threads (3 unresolved / 7 total)
### 🔴 src/main.rs:42
- @reviewer (2026-05-20): <comment>
  - @author: <reply>

## Discussion
- @reviewer (2026-05-21): <top-level comment>
```

The skill defines `gh --template` / `--jq` snippets that emit this directly, so
output is deterministic across calls.

## Cross-harness wiring

| Harness | How it loads |
|---------|--------------|
| Claude Code | add `github-pr` plugin entry to `.claude-plugin/marketplace.json`; skill lives at `plugins/github-pr/skills/github-pr/SKILL.md` |
| pi | add `plugins/github-pr/skills` to the `pi.skills` array in `package.json` (top-level `skills/` is a symlink to rust-dev only, so it won't be auto-found otherwise) |

## Files

```
plugins/github-pr/
├── DESIGN.md                          (this file)
├── .claude-plugin/plugin.json
└── skills/github-pr/SKILL.md          (recipes + canonical format + gh/jq snippets)
```

No `scripts/` directory — `gh --jq`/`--template` is the renderer.

## Auth & deps

- Auth: delegated entirely to the user's `gh` CLI. No tokens in the skill.
- Deps: `gh` only (its embedded jq covers rendering). Standalone `jq` optional.

## Non-goals (v1)

- Writing reviews / approving / merging. Read-only.
- Reply / resolve-thread mutations — deferred to v2 behind explicit instruction,
  so the agent can't mutate a PR by accident.
- Caching. Every call is live.

## Decisions resolved from review

- **TypeScript over Python?** Sidestepped — rendering moves into `gh --jq`, so
  there's no script in any language to maintain.
- **One artifact for both pi & Claude Code?** Yes — a SKILL.md, the only
  mechanism both harnesses load natively.
- **MCP?** Dropped. pi can't use it; it adds a server/protocol for no gain over
  Bash + `gh`.
```
