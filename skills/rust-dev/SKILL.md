---
name: rust-dev
description: Rust development conventions and mandatory post-change pipeline. Use whenever working with Rust code, .rs files, Cargo.toml, Cargo.lock, cargo / rustc / clippy / rustfmt commands, crates, traits, lifetimes, async Rust, workspaces, build.rs, or any task that writes, refactors, debugs, tests, or reviews Rust code.
---

# Rust Development Rules

These rules are mandatory for every Rust change in this environment. Do not skip steps "because the change is small".

## 1. Module & file structure

- Keep files **under 500 lines**. Split when they grow past that.
- Modules must be **atomic** — one clear responsibility per module.
- Tests live in **separate files / modules**, never inlined in the middle of production functions.
- Integration tests under `tests/` are split into **small, meaningfully-named files**, not one mega-file.

## 2. Code decisions
- When starting a new project always set the `clippy` to pedantic mode.
- When starting a new project consult user about the license and generate corresponding `deny.toml`
- All the created code should be an idiomatic Rust: use the language features that prevent errors and improve readability. Errors, not return codes, typed enums not just constants and so on.
- In terms of memory avoid unnecessary allocations especially with dynamic dispatch. All the `Box` and unnecessary clones should be agreed with user even if they make architecture simpler. Only use after confirmation.
- Reduce the number of dependencies. Apply `cargo deny check` when changing the dependency list. Consult with user regarding the details.

## 3. Mandatory post-change pipeline

After **every** code change, run this sequence in order. Do not run tests until the first three pass clean:

```bash
cargo clippy --fix --all-features --allow-dirty --all-targets --workspace
cargo fix --all-features --allow-dirty --all-targets --workspace
cargo fmt --all
```

Then, and only then:

```bash
cargo test --verbose --all-features --workspace  # or `cargo nextest run` if available
```

If any of the four commands reports issues, fix them and **restart the pipeline from the top**.

For large/noisy outputs, route through `ctx_execute` so the raw output stays out of context — print only the failure summary.

## 4. Quality gates (non-negotiable)

- **`cargo clippy` must be clean.** No warnings.
- **No `#[allow(...)]` attributes** anywhere in production code. Fix the issue, don't mask it. This includes `#[allow(dead_code)]`, `#[allow(clippy::*)]`, etc. — delete unused code instead of allowing it.
- **No excluded tests.** If a test is flaky, either fix it or delete it — never `#[ignore]` it into oblivion.
- **No `unwrap()`, `expect()`, `panic!()`** in production paths (tests are okay). Propagate errors via `?` and a proper error type. Killing the process is not error handling.
- **Coverage must not drop.** Validate with `cargo tarpaulin --all-features --workspace --out lcov` before declaring a change done. Newly added functions are **never** excluded from coverage.
- **The code is tested**. Apply `cargo tarpaulin --all-features --workspace --out lcov` followed by `cargo crap --workspace --lcov lcov.info --format markdown` and ensure that there are no non-tested parts.

## 5. Hygiene

- After a change that affects configuration, update `config.example.toml` to match.
- Comments are **short and to the point**. No obvious comments that restate what the code already says.
- Rustdoc carries only the information required — no filler prose.
- Idiomatic, statement-oriented Rust. Prefer pattern matching, small functions, and the type system over runtime checks.

## 6. Scope discipline

- If issues are reported in the module you are touching, **fix them** — even if you think they predate your change. Touching a module makes its warnings yours.
- Bugs discovered while testing or fixing tests are **part of the current slice**. Fix them now, not "later".
- Do not change a function's behavior to make a failing test pass. If the test is wrong, fix the test; if the function is wrong, fix the function — never both at once to paper over a mismatch.
- Do not perform unrequested side-quests. Complete the explicit task; flag adjacent issues separately.

## 7. Specifications via `anodized`

Non-trivial functions must carry an `anodized` spec. The `#[spec]` attribute documents and (optionally) checks the function's contract using ordinary Rust expressions, so it is type-checked by the compiler and understood by rust-analyzer.

### When to apply a spec

Apply `#[spec]` to a function when **at least one** is true:

- It is `pub` or otherwise crosses a module boundary.
- Its inputs have a non-trivial valid domain (range, non-empty, sorted, in-bounds index, matching lengths, etc.).
- Its output has a non-trivial guaranteed property (bounded, length relation, `Ok` only under specific conditions).
- It contains a loop whose correctness depends on a non-obvious invariant — attach the invariant to the loop, not the function.

Do **not** add a spec when the only condition you can write restates the type system (`x: u32` is already non-negative — don't write `requires: [x >= 0]`). Specs that add no information are noise and must be omitted.

### How to apply

1. Add the dependency (major version only, per §2):
   ```toml
   [dependencies]
   anodized = "0"
   ```
2. Import and annotate with a single `#[spec(...)]` block — anodized uses **one unified attribute**, not separate `#[requires]` / `#[ensures]`:
   ```rust
   use anodized::spec;

   #[spec(
       requires: [
           !slice.is_empty(),
           index < slice.len(),
       ],
       ensures: [
           *output == slice[index],
       ],
   )]
   fn nth<T: Copy>(slice: &[T], index: usize) -> T {
       slice[index]
   }
   ```
3. Clause conventions:
   - Each clause is a `bool` Rust expression — the compiler and rust-analyzer type-check it.
   - Prefer **many small clauses** over one big `&&` chain; runtime panics name the failing clause verbatim.
   - In `ensures:` the return value is bound as `*output` (it is a reference — keep the deref).
   - Use only side-effect-free expressions. Pure helpers are fine; anything that mutates, allocates non-trivially, or performs I/O is not.
   - Reference parameters by their original names; do not shadow them inside the spec block.
   - Order: `requires` before `ensures`.

### Validation

Runtime checks are **off by default** — the attribute compiles to nothing in normal builds, so there is zero runtime cost. Enable them only for test runs:

```bash
RUSTFLAGS="--cfg anodized_panic" cargo test --workspace --all-features
```

A violated clause panics with the exact clause text and source location. Treat such a panic as a failing assertion: fix the caller (precondition violation) or the implementation (postcondition violation). **Never relax the spec to make a test pass** unless the spec was provably wrong — in which case fix the spec and explain why in the commit message.

### What not to do

- Do not use `#[spec]` as a substitute for error handling. Preconditions describe what callers **must** uphold; recoverable failure modes still go through `Result`.
- Do not gate `#[spec]` behind a feature flag — the attribute already compiles away without `--cfg anodized_panic`, so there is nothing to gate.
- Do not mix `anodized` with the older `contracts` crate in the same workspace — pick one (this codebase uses `anodized`).

## 8. Tooling preference inside this agent

- Prefer `lsp_diagnostics` / `lsp_navigation` (rust-analyzer) for type errors and rename/refactor before reaching for `cargo check`.
- Prefer `ast_grep_search` over text grep for structural Rust queries.
- Run cargo commands via `ctx_execute` when output is likely to exceed ~20 lines.
