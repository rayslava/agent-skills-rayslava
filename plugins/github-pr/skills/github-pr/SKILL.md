---
name: github-pr
description: Read GitHub Pull Requests and render them as clean markdown using the gh CLI. Use whenever the task involves a GitHub PR / pull request — viewing a PR, reading review comments or review threads, checking resolved/unresolved discussions, inspecting CI checks and failing job logs, or listing PRs. Produces consistent markdown via gh's built-in --jq / --template (no Python, no extra scripts).
---

# GitHub PR access (gh + jq)

Read PRs and render consistent markdown using the `gh` CLI you already have via
the Bash tool. `gh` ships an embedded jq, so `--jq`/`-q` and `--template` do all
rendering — **no Python, no bundled script, no MCP**.

## Prerequisites

- `gh` authenticated (`gh auth status`). All auth is delegated to `gh`; never
  handle tokens here.
- **Read-only.** These recipes never mutate a PR. Do not approve, merge, reply,
  or resolve threads unless the user explicitly asks (that is out of scope here).

## Resolve the repo first

Most commands take `--repo OWNER/REPO`. Resolve it once from the current dir:

```bash
R=$(gh repo view --json nameWithOwner -q .nameWithOwner)
```

For GraphQL (which needs owner/name split), use `-F owner=… -F repo=…`.
When the user names a repo explicitly, use that instead.

## The full PR view (default workflow)

Run these in sequence and assemble the canonical layout below. Replace `N` with
the PR number.

### 1. Header

```bash
gh pr view N --repo "$R" \
  --json number,title,state,isDraft,author,baseRefName,headRefName,mergeable,reviewDecision \
  --template '#{{.number}} {{.title}}
{{.state}}{{if .isDraft}} (draft){{end}} · @{{.author.login}} · base `{{.baseRefName}}` ← head `{{.headRefName}}`
mergeable: {{.mergeable}} · review: {{.reviewDecision}}'
```

### 2. Body

```bash
gh pr view N --repo "$R" --json body -q .body
```

### 3. Checks

```bash
gh pr view N --repo "$R" --json statusCheckRollup \
  -q '.statusCheckRollup[]
      | "| \(if (.conclusion // .state)=="SUCCESS" then "✅" elif (.conclusion // .state)=="FAILURE" then "❌" else (.conclusion // .state) end) | \(.name // .workflowName) |"'
```

### 4. Review threads with resolution state (GraphQL — REST cannot return `isResolved`)

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$num:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$num){
      reviewThreads(first:100){nodes{
        isResolved path line
        comments(first:50){nodes{author{login} body createdAt}}
      }}
    }}}' \
  -F owner="${R%/*}" -F repo="${R#*/}" -F num=N \
  -q '.data.repository.pullRequest.reviewThreads.nodes
      | "## Review threads (\([.[]|select(.isResolved|not)]|length) unresolved / \(length) total)\n",
        (.[] |
          "### \(if .isResolved then "✅" else "🔴" end) \(.path):\(.line)",
          (.comments.nodes | to_entries[] |
            if .key==0
            then "- @\(.value.author.login) (\(.value.createdAt|split("T")[0])): \(.value.body|gsub("\n";" "))"
            else "  - @\(.value.author.login): \(.value.body|gsub("\n";" "))" end))'
```

### 5. Discussion (top-level, non-diff comments)

```bash
gh api "repos/$R/issues/N/comments" --paginate \
  -q '.[] | "- @\(.user.login) (\(.created_at|split("T")[0])): \(.body|gsub("\n";" "))"'
```

## Canonical output

Assemble the above into:

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

## Targeted recipes

**Only unresolved threads** — append to the GraphQL `-q`:
`.data.repository.pullRequest.reviewThreads.nodes | map(select(.isResolved|not)) | ...`

**Inline diff comments without resolution state** (flat, fast — REST):

```bash
gh api "repos/$R/pulls/N/comments" --paginate \
  -q '.[] | "[\(.path):\(.line // .original_line)] @\(.user.login): \(.body|gsub("\n";" "))"'
```

**CI: list checks, then tail a failing job's log:**

```bash
gh pr checks N --repo "$R"
gh api "repos/$R/actions/jobs/<JOB_ID>/logs" \
  -q 'split("\n")[] | select(test("error|fail|##\\[error\\]";"i"))' | tail -40
```

**List PRs:**

```bash
gh pr list --repo "$R" --state open --limit 20 \
  --json number,title,author,state,url \
  --template '{{range .}}#{{.number}} [{{.state}}] {{.title}} (@{{.author.login}}){{"\n"}}{{end}}'
```

## Notes

- Always `--paginate` REST comment endpoints; long PRs exceed one page.
- Diff (inline) comments live on `pulls/N/comments`; general discussion lives on
  `issues/N/comments`. They are different endpoints.
- `reviewDecision`, `mergeable` may be `null`/`UNKNOWN` while GitHub computes
  them — re-run after a few seconds if needed.
- Bodies can be long. For a scan, truncate in jq with `.body[0:200]`; drop the
  slice when the user wants full text.
