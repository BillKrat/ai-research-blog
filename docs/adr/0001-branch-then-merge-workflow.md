# 0001. Branch-then-merge workflow

Status: Accepted
Date: 2026-08-01

## Context

`main` auto-deploys to Railway on every push. Committing in-progress
work directly to `main` means every intermediate commit goes live on
`blogresearch.net`, including broken states.

## Decision

Feature work happens on a branch (e.g. `feature/postgres`). Commit
freely as work progresses — no need to keep history tidy, this is a
learning project. Merge into `main` (and push) only once the branch is
working end to end.

## Consequences

- A bit more ceremony (branch, then merge) than committing straight to
  `main`.
- `main` stays deployable at all times; the live site reflects only
  finished work.
- Long-lived feature branches should still be pushed to `origin`
  periodically so work isn't stranded on one machine.
