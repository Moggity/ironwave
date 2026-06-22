# Retrospective: the `Onboarding-improvements` branch

A short, honest accounting of what this branch set out to do, what it became, and
how to keep future work from sprawling the same way.

## What the feature was meant to be

The branch was named **Onboarding-improvements**. The concrete plan, written up
in `docs/dynamic-routine-engine-design.md`, was a **Dynamic Routine Adaptation
Engine**: three training tracks (powerlifting / powerbuilding / bodybuilding), a
per-session time budget, and a bodybuilding muscle-focus slider system. That was
already a sizeable feature, larger than the branch name implies.

## What was actually achieved

- **Tracks + onboarding:** goal, experience, time-per-session, and (bodybuilding)
  seven muscle-focus sliders. New program templates for each track.
- **Per-athlete volume landmarks**, seeded by experience, evolving block to block
  from logged performance, soreness, and readiness.
- **Muscle-focus reallocation (FOCUS):** sliders reshape accessory volume, remove
  a muscle at 0, and (for hypertrophy) drop the main lift of a removed muscle.
- **Session time model:** realistic time estimate, an onboarding estimate vs the
  athlete's limit, and **Core / Optional time tiers** (no more silent trimming),
  with a one-block **carryover** that drops optionals you never train.
- **Bodybuilding programming:** dedicated hypertrophy day templates, then a
  **frequency-driven split generator** that builds the week from the sliders
  (region days proportional to slider points, leadership rotating across muscles).
- Dozens of edge-case fixes found by testing weird slider combinations.

## Honest classification

### Legitimate, in-scope bug fixes (fixing the feature so it works)
- Pressing accessories ignored the Chest/Shoulders sliders (a real movement-tag
  bug). Fixed by mapping bench->Chest, press->Shoulders.
- Empty training days from extreme slider configs. Fixed with refill + a guard.
- The deadlift-less hypertrophy day led by Good Mornings (a real design flaw from
  reusing strength templates).
- Time estimates were too generous (constant calibration).
- Day titles hid the "Day N" numbering behind the split theme.

These are the kind of fixes that *belong* inside the feature branch: the feature
was not correct until they were done.

### Scope creep (new capability beyond "onboarding improvements")
- The entire **bodybuilding program generator** (dedicated templates -> frequency
  driven split). This is a new programming engine, not an onboarding change.
- **Core/Optional time tiers + carryover learning.**
- **Landmark evolution.**
- The **session-time estimate, budget-aware Add, and time-by-week** views.

Each was individually reasonable and user-requested, but cumulatively the branch
grew from "improve onboarding" into "redesign the bodybuilding training engine."
Most of the growth came from **iterative discovery**: a screenshot revealed a
rough edge, which motivated a fix, which revealed a deeper design gap, which
motivated a new sub-feature. That is a natural and often valuable loop, but it is
exactly how a branch quietly triples in size.

### A candid note on process
The expansion was healthy in spirit (the product got much better) but poor in
shape: it should have been **several branches and PRs**, not one. At multiple
points the right move was to say "this is a new feature, let us land what we have
and open a fresh branch," and instead each new idea was built immediately on top.

## How to avoid this kind of scope creep

1. **Write the acceptance criteria before coding, and treat it as a contract.**
   The design doc existed, but the branch outgrew it without the doc being the
   gate. When a request falls outside the written scope, that is the signal.
2. **One concern per branch.** When a "fix" turns into a new capability, stop and
   cut a new branch. "Fixing the bodybuilding day that leads with Good Mornings"
   was a fix; "generating the split from sliders" was a new feature and deserved
   its own branch.
3. **Park new ideas in a future-work list instead of building them now.** This
   repo has `docs/pending-future-work.md` for exactly that. Adding to it is
   progress; it does not have to be built this branch.
4. **Use a size tripwire.** If a branch passes ~5-10 commits, or starts touching
   files unrelated to its name, split it. This branch had ~25 commits.
5. **Ship the foundation, merge, then iterate.** Each step here was built to be a
   no-op for default users, which means the foundation could have merged early
   and the rest landed as small follow-up PRs against a moving `main`.
6. **Name the branch for its real scope.** `Onboarding-improvements` stopped
   describing the work after the third commit; that mismatch is itself a warning.

## Git branching best practices (general)

- **Short-lived, single-purpose branches.** A branch should answer one question
  and be mergeable in days, not weeks.
- **Prefix by intent:** `feat/`, `fix/`, `docs/`, `chore/` (this repo's
  `CONTRIBUTING.md` asks for these; `Onboarding-improvements` did not follow it).
- **Keep `main` always releasable.** Land small, vertical slices behind defaults
  or flags rather than one large horizontal change.
- **Small, frequent PRs beat one giant PR.** They review faster, regress less,
  and bisect cleanly when something breaks.
- **Branch off `main`, rebase or merge `main` in often** to avoid drift and
  painful conflicts.
- **One unrelated discovery = one new branch.** Found a bug while building a
  feature? Branch from `main`, fix it, PR it separately.
- **Conventional Commits, imperative mood**, with the *why* in the body when it
  is not obvious. Each commit should stand on its own and keep `main` runnable.
- **Delete merged branches** to keep the remote clean.
- **Verify before merge:** run the app and the relevant checks; for engine-level
  changes, confirm behavior for the default path is byte-identical.

## The constructive takeaway

The work is good and well-tested, and every change kept default users
byte-identical. The lesson is not "do less," it is **"slice it thinner":** the
same scope, delivered as a foundation PR plus a handful of focused follow-ups,
would have been easier to review, lower risk, and clearer to reason about. The
pending list (`docs/pending-future-work.md`) is the place to start practicing
that discipline for the next round.
