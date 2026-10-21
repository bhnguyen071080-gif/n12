# TV-EAM — handoff, 21/10/2026 (UTC+7)

## Current work

Continue from `codex/tv-eam-phase3`, not `main` (which still contains only the initial README). This repair starts at `1a0fe7f31b5edc5a53cee30f04ba7656ccd1b2c4` and targets that development branch.

Fixed in this change:
- Clean-build print font downloads use an immutable Noto repository commit and verified SHA-256 values, with the matching OFL license. The moving distribution URL previously returned different font bytes and blocked pretest/prebuild.
- Planned dates are formatted as calendar dates, independent of the device time zone.
- Regression tests cover all 48 group/mode combinations and interactive preview grouping, source separation, stale-preview invalidation and dates in UTC/Vietnam time zones.

Verification: TypeScript strict and all 68 unit tests passed locally (Node 24, in-process TypeScript diagnostic runner because Windows blocked esbuild subprocesses). The authoritative standard Node 22 build, unit, browser and database results are the GitHub Actions checks attached to the repair PR. Do not infer cloud deployment from those checks.

## Remaining product work

`/requisitions` is still a preview-only October 2026 maintenance plan. It does not save a plan, create actual work cases, or transfer those previews to printable BM.08.06 documents. The existing case-document PDF flow is separate.

Next: agree and implement catalog matching and an idempotent plan-save workflow, then creation of work cases and printable vouchers. Verify with authenticated test data before production use. Do not invent a source of truth for the hardcoded monthly plan or import it into a real workspace automatically.

At the next session: fetch the development branch, inspect the repair PR/checks and new commits, read this handoff, and record the tested commit and remaining scope after changes.
