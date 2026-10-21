# TV-EAM — handoff, 22/10/2026 (UTC+7)

The active app branch is `codex/tv-eam-phase3`; `main` still contains only the initial README. PR #3 fixed immutable font downloads and calendar-date display and was merged as `88da793c1ac38dbc1807b87e3391437bb8469069`.

PR #4 implements `/requisitions` saving for the existing October 2026 source plan:
- Explicit workspace-catalog mapping, review and confirmation before saving.
- Immutable versioned snapshots, idempotent retries and one pending maintenance case per equipment/planned day. Regrouping reuses cases.
- Separate warehouse/consumables PDFs, grouped by equipment, group or day, using BM.08.06 with two A5 copies per A4 sheet.
- A saved-plan detail page with source allocations and real case links. Actual issue, price, completion and signatures are not inferred. Planning does not create stock or material-usage transactions.
- Existing case-document source validation remains separate and unchanged.

Verification at initial feature commit `eef040ed63c115b5af03f5a6e9b4cdb0c83cb9ca`:
- Web Actions run `39678473489`: 71 unit tests, 16 browser tests, strict TypeScript, dependency audit and production build passed.
- Database Actions run `39678473741`: full PostgreSQL17 regression suite passed, including workspace isolation, role boundaries, immutable snapshots, retries, case reuse and atomic rollback.
- Both grouped PDF sources rendered; Vietnamese glyphs and A4 two-copy layout visually checked with synthetic data.
- Additive `maintenance_requisition_runs` migration applied to the connected database. A rollback-only smoke test exercised the RPC under an existing authenticated role; retry and pending-state checks passed. Subsequent read confirmed zero saved test plans and zero residual test cases.
- New tables have RLS; anonymous execution and direct authenticated updates are denied. The two private registries intentionally expose no policies/grants. The pre-existing leaked-password-protection warning remains an account configuration item.

Deployment follows the existing Netlify integration. The PR #4 deploy preview built successfully. Updating Phase 3 updates the existing PR #2 preview. Netlify Team Protection requires the user's browser login for direct authenticated end-to-end verification; do not claim that verification from CI alone.

Scope remains the supplied October 2026 source plan. Arbitrary-month source import, editing saved versions and posted warehouse issues are separate work. Never auto-import the source into real operational data or apply test fixtures to the connected database. No private project identifiers, credentials or operational records belong in this public repository.
