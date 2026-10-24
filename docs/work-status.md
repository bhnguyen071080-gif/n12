# TV-EAM handoff — 24/10/2026 (UTC+7)

PR #4 is merged into `codex/tv-eam-phase3` at `cdc458133edbc890f086a01d35f9f7b2504f0900`. Netlify deployed that commit to deploy-preview-2. The integrated maintenance-plan workflow preserves the latest repair/maintenance split, source-PDF metadata, separate document date and supplemental shortfall form.

Saved plans have a dedicated detail page and BM.08.06 PDF endpoint. The atomic-save migration includes all metadata in the initial immutable insert, preserves pending-case semantics, validates supplemental materials against the workspace catalog and fingerprints source metadata for safe retries. The connected database has this migration; an authenticated v3 save/retry smoke test passed and rolled back all test writes. Cloud migration version `20261023135354` corresponds to source file `20261023125856_maintenance_requisition_atomic_save.sql`; do not reapply it based solely on the different timestamp. Historical cloud migrations also have deployment-time versions.

The verified PR #4 head passed strict TypeScript, production build, 72 unit tests, 16 browser tests and all database checks. Post-merge database checks passed and Netlify deployed successfully. A newly updated Zod advisory then blocked post-merge web CI. This follow-up pins Zod 4.6.7, uses explicit string keys for records and preserves the existing UUID-shaped database identifier contract with `z.guid()`. Local strict TypeScript and 74 unit tests pass; added coverage confirms oversized document-line arrays are rejected before their contents are traversed. Standard GitHub CI remains the release gate.

Selecting a source PDF records filename/hash; it does not extract file contents. The material list remains the supplied October 2026 plan plus explicitly selected supplemental shortfalls. No operational plan was saved on behalf of the user.

Remaining acceptance check: the live browser still reaches Netlify Team Protection. After the user signs in with an invited account and signs into the app, verify source confirmation, save, history/detail and BM.08.06 download/print. Automated browser tests and rollback-only database checks do not replace this authenticated deployment check.

No credentials, private project identifiers or operational records belong in this public repository. Never apply fixture SQL to the connected database.