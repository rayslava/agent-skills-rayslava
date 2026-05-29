---
name: github-pr-write
description: Create, edit, and respond to GitHub Pull Requests using the gh CLI. Use when the task involves authoring or modifying a PR — opening a PR (draft or ready), editing its title/body/base, marking a draft ready, replying to review threads, resolving/unresolving review threads, posting a top-level PR comment, managing labels/reviewers/assignees, or closing/reopening a PR. Write counterpart to the github-pr (read) skill. Mutates real PRs, so it confirms before every write.
---

# GitHub PR write (gh)

Create, edit, and respond to PRs using the `gh` CLI through the Bash tool. No
Python, no bundled script, no MCP. The read counterpart is the `github-pr` skill
(view PRs, list unresolved review threads + their node IDs); this skill acts on
them.

**These recipes mutate real PRs.** Follow the safety rules below.

## Safety rules (non-negotiable)

1. **Confirm before every write.** Echo the exact target (repo + PR number) and a
   summary or diff of what will change, then get explicit user confirmation
   before running any mutating command. Never write silently.
2. **`merge` is out of scope.** Do not run `gh pr merge`. `close`/`reopen`
   *are* in scope (Tier 3) but require **explicit user intent** in the request
   — never inferred — and confirmation like any other write.
3. **Body edits are read-modify-write.** `gh pr edit --body` *replaces the entire
   body*. Never blind-overwrite. Fetch the current body, modify a copy, write it
   back via `--body-file -`.
4. **Auth is delegated to `gh`** (`gh auth status`). Never handle tokens.
5. **Be explicit about the target.** Resolve the repo and always pass
   `--repo "$R" N` so you never mutate the wrong PR.

## Resolve the repo first

```bash
R=$(gh repo view --json nameWithOwner -q .nameWithOwner)
```

For GraphQL, owner/name split as `${R%/*}` / `${R#*/}`. When the user names a
repo explicitly, use that instead.

## Tier 1 — author a PR

### Create

Draft, explicit base, body from stdin (heredoc avoids shell-quoting pitfalls):

```bash
gh pr create --repo "$R" --draft --base main --title "feat: …" --body-file - <<'EOF'
## Summary
…

## Test plan
…
EOF
```

Other create options: `--head <branch>` (or `<user>:<branch>`), `--reviewer
<login>`, `--label <name>`, `--assignee @me`. To autofill title/body from
commits instead of writing them: `gh pr create --repo "$R" --fill`.

Confirm the URL it prints, then report it back.

### Edit title / base

```bash
gh pr edit N --repo "$R" --title "feat: …"
gh pr edit N --repo "$R" --base main
```

### Edit body (safe read-modify-write)

Never pass `--body` blindly. Fetch first, edit, write back:

```bash
# 1. capture current body
gh pr view N --repo "$R" --json body -q .body > /tmp/pr-N-body.md
# 2. edit /tmp/pr-N-body.md (make the change), then show the user the diff
# 3. write it back
gh pr edit N --repo "$R" --body-file /tmp/pr-N-body.md
```

For a small surgical change you can pipe through an explicit transform, but still
show the before/after and confirm:

```bash
body=$(gh pr view N --repo "$R" --json body -q .body)
new=$(printf '%s' "$body" | sed 's|old text|new text|')
printf '%s' "$new" | gh pr edit N --repo "$R" --body-file -
```

### Mark a draft ready

```bash
gh pr ready N --repo "$R"
```

## Tier 2 — respond to review

Thread node IDs (`PRRT_…`) come from the `github-pr` skill's `reviewThreads`
query. **Canonical loop: reply → confirm the reply landed → then resolve**, so a
thread is never resolved without a recorded response.

### Reply to a review thread

```bash
gh api graphql -f query='
mutation($t:ID!,$b:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$t, body:$b}){
    comment{ id url }
  }}' -F t="<THREAD_ID>" -F b="Fixed in <commit>: <what changed>." \
  -q '.data.addPullRequestReviewThreadReply.comment.url'
```

### Resolve a thread

```bash
gh api graphql -f query='
mutation($t:ID!){ resolveReviewThread(input:{threadId:$t}){ thread{ isResolved }}}' \
  -F t="<THREAD_ID>" -q '.data.resolveReviewThread.thread.isResolved'
```

### Unresolve a thread

```bash
gh api graphql -f query='
mutation($t:ID!){ unresolveReviewThread(input:{threadId:$t}){ thread{ isResolved }}}' \
  -F t="<THREAD_ID>" -q '.data.unresolveReviewThread.thread.isResolved'
```

### Top-level discussion comment

```bash
gh pr comment N --repo "$R" --body "…"
```

## Tier 3 — lifecycle, labels, reviewers

Lower-frequency management actions. Same confirm-before-write rule applies.

### Labels

Add or remove labels on a PR (labels must already exist on the repo):

```bash
gh pr edit N --repo "$R" --add-label "bug" --add-label "needs-review"
gh pr edit N --repo "$R" --remove-label "needs-review"
```

List existing labels, or create one that's missing before adding it:

```bash
gh label list --repo "$R" --json name,description -q '.[] | "\(.name)\t\(.description)"'
gh label create "needs-review" --repo "$R" --color 0E8A16 --description "Awaiting review"
```

`gh label create` is idempotent with `--force` (updates color/description if the
label already exists). Confirm new label name/color with the user first.

### Reviewers and assignees

```bash
gh pr edit N --repo "$R" --add-reviewer alice --add-reviewer bob
gh pr edit N --repo "$R" --remove-reviewer bob
gh pr edit N --repo "$R" --add-assignee @me
gh pr edit N --repo "$R" --remove-assignee @me
```

### Close / reopen (explicit intent required)

Only when the user explicitly asks to close or reopen. Confirm first; an optional
comment records why.

```bash
gh pr close N --repo "$R" --comment "Superseded by #123"
gh pr reopen N --repo "$R" --comment "Reopening to address follow-up"
```

`gh pr close --delete-branch` also deletes the local and remote branch — do not
use it unless the user explicitly asks to delete the branch.

### Batch the review loop

When clearing several threads, confirm the full set with the user first, then
iterate — reply to each, verify, and only resolve threads you actually answered:

```bash
# THREAD_ID<TAB>reply body, one per line, in /tmp/replies.tsv
while IFS=$'\t' read -r tid body; do
  gh api graphql -f query='mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$t,body:$b}){comment{id}}}' \
    -F t="$tid" -F b="$body" -q '.data.addPullRequestReviewThreadReply.comment.id' \
  && gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' \
    -F t="$tid" -q '.data.resolveReviewThread.thread.isResolved'
done < /tmp/replies.tsv
```

## Notes

- `-F` sends typed GraphQL variables (and `ID!` strings); use it for `body` too
  so newlines and quotes survive. Avoid interpolating user text into the query
  string.
- After a write, re-run the relevant `github-pr` read recipe to confirm the new
  state rather than trusting the mutation echo alone.
- `mergeable` / `reviewDecision` may lag; give GitHub a moment before re-reading.
