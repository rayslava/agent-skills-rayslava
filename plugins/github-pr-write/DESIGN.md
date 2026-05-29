# github-pr-write — design

A reusable **skill** to create, edit, and respond to GitHub Pull Requests using
the `gh` CLI via the Bash tool. The write-side counterpart to the read-only
[`github-pr`](../github-pr/DESIGN.md) skill: that one surfaces PRs and their
unresolved review threads (with node IDs); this one acts on them.

## Form factor

Same as `github-pr`: a single `SKILL.md`, driven by `gh` through the Bash tool.
No Python, no bundled script, no MCP. Loads natively in pi and Claude Code.

The difference is **these recipes mutate real PRs**, so safety is the central
design concern, not rendering.

## Safety stance (the core of this skill)

1. **Confirm before every write.** The skill instructs the agent to echo the
   exact mutation (PR number, repo, and a diff/summary of what changes) and get
   explicit user confirmation before running it. No silent writes.
2. **`merge`, `close`, and `reopen` always require explicit user intent** in the
   request — never inferred. `merge` is excluded from v1 entirely.
3. **Body edits are read-modify-write.** `gh pr edit --body` *replaces* the whole
   body. To avoid clobbering, the skill fetches the current body first, edits a
   copy, and writes back via `--body-file -` (stdin) — never a blind overwrite.
4. **Auth delegated to `gh`.** No tokens. Respects whatever account `gh` uses.
5. **Repo/PR are explicit.** Resolve `R=$(gh repo view --json nameWithOwner -q .nameWithOwner)`
   and pass `--repo "$R" N` so the agent never mutates the wrong PR.

## Recipes by tier

`R` = `owner/repo`; `N` = PR number. Thread node IDs (`PRRT_…`) come from the
`github-pr` skill's `reviewThreads` query.

### Tier 1 — author a PR

| Action | Command |
|--------|---------|
| Create (draft) | `gh pr create --repo "$R" --draft --base main --title "…" --body-file -` (body on stdin) |
| Create (fill from commits) | `gh pr create --repo "$R" --fill` |
| Edit title | `gh pr edit N --repo "$R" --title "…"` |
| Edit body (safe) | read-modify-write: `gh pr view N --json body -q .body` → edit → `gh pr edit N --body-file -` |
| Change base | `gh pr edit N --repo "$R" --base main` |
| Mark ready | `gh pr ready N --repo "$R"` |

Multi-line bodies use `--body-file -` with a heredoc on stdin (avoids shell
quoting pitfalls):

```bash
gh pr edit N --repo "$R" --body-file - <<'EOF'
## Summary
…
EOF
```

### Tier 2 — respond to review (the high-frequency loop)

For each unresolved thread surfaced by `github-pr`:

| Action | Command |
|--------|---------|
| Reply to a thread | `gh api graphql -f query='mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$t,body:$b}){comment{id}}}' -F t=<THREAD_ID> -F b="…"` |
| Resolve a thread | `gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -F t=<THREAD_ID>` |
| Unresolve a thread | `gh api graphql -f query='mutation($t:ID!){unresolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -F t=<THREAD_ID>` |
| Top-level comment | `gh pr comment N --repo "$R" --body "…"` |

Canonical workflow: reply, confirm the reply landed, **then** resolve — so a
thread is never resolved without a recorded response.

## Cross-harness wiring (same as github-pr)

| Harness | How it loads |
|---------|--------------|
| Claude Code | `github-pr-write` entry in `.claude-plugin/marketplace.json`; skill at `plugins/github-pr-write/skills/github-pr-write/SKILL.md` |
| pi | add `./plugins/github-pr-write/skills` to the `pi.skills` array in `package.json` |

## Files

```
plugins/github-pr-write/
├── DESIGN.md                                    (this file)
├── .claude-plugin/plugin.json
└── skills/github-pr-write/SKILL.md
```

## Auth & deps

- Auth: delegated entirely to `gh`. No tokens in the skill.
- Deps: `gh` only.

### Tier 3 — lifecycle / labels (lower frequency)

- Add/remove labels, list labels, create a missing label (`gh label create` /
  `gh pr edit --add-label`/`--remove-label`).
- Add/remove reviewers and assignees (`gh pr edit --add-reviewer` etc.).
- Close / reopen (`gh pr close` / `gh pr reopen`) — **explicit user intent
  required**, never inferred; `--delete-branch` only on explicit request.

## Non-goals

- **Merge** (`gh pr merge`) — destructive; excluded. Add later behind a
  mandatory explicit confirmation if ever needed.
- **Submitting formal reviews** with batched inline comments
  (`addPullRequestReview`) — deferred; the thread-reply loop covers the common
  case.
- Force-push / branch rewriting — not a PR-level concern.

## Verified before writing this plan

- `gh pr create` flags: `-d/--draft`, `--title`, `-b/--body`, `-F/--body-file -`,
  `-B/--base`, `-H/--head`, `--reviewer`, `--label`.
- `gh pr edit` flags: `--title`, `--body`, `--base`, `--add-label`,
  `--remove-label`, `--add-reviewer`.
- `gh pr ready`, `gh pr comment --body` exist.
- `gh label create` (`-c/--color`, `-d/--description`, `-f/--force`),
  `gh label list --json`, `gh pr close` (`-c/--comment`, `-d/--delete-branch`),
  `gh pr reopen` (`-c/--comment`), and `gh pr edit`
  `--add-reviewer`/`--remove-reviewer`/`--add-assignee`/`--remove-assignee`.
- GraphQL mutations exist (schema introspection): `addPullRequestReviewThreadReply`,
  `resolveReviewThread`, `unresolveReviewThread`.

## Relationship to github-pr

`github-pr` (read) → finds PRs, renders them, lists unresolved threads + node IDs.
`github-pr-write` (write) → consumes those IDs to reply/resolve, and authors/edits
PRs. Kept as **separate skills** so read-only contexts never load mutation
recipes, and the write skill can carry its own safety guardrails.
