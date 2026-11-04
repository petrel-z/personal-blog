# Execution ledger — 2026-10-22-admin-login-repair

Current workspace: `/Users/petrel/project/blog/blog`, branch `dev`. User requested direct dev development with no commits. The isolated-worktree entries below describe the earlier development and validation history.

- Workspace: /Users/petrel/.codex/worktrees/admin-login-phase1/blog, branch codex/admin-login-phase1.
- User authorized F01–F04 in this side chat; subagents prohibited. Work remains isolated from the parent checkout. Native registration failed because the side-chat ID is unknown to the app; the worktree itself exists and is usable.
- F01 target confirmed by user: 1207574452@qq.com. Original password hash was malformed; user authorized a random replacement in a private local file. Recovery is complete.
- Pre-flight F02→F03: hook owns image/id/input; F03 switches all consumers together from separate verification to in-request verification.
- Pre-flight F03→F04: login consumes captcha before password and failure counting; failures must commit before throwing a safe Auth.js error.
- Ruling: use one isolated test database and port 3017 for UI and real concurrency tests; do not reuse the parent's running application or generated Prisma client.
- Ruling: retain protected source test artifacts and this ledger until delivery; no commits or merge into the parent's checkout are necessary to provide a reviewable change.
- Ruling: defer shared role-directory creation to F05, where it is first consumed; no unused stage-two scaffolding.
- Review will be a separate self-review because the side-conversation instructions prohibit subagents.

- F01: roles restored only for the confirmed QQ account. User explicitly requested a random password in a private local file; password updated and bcrypt checked, file mode 0600. Production browser login confirmed the intended identity, /admin/dashboard destination, all 17 permissions and HTTP 200 from /api/auth/users; verification session signed out.
- F02: browser regressions reproduced (4 failures), then 4/4 passed after the hook/component/form changes. Added rapid refresh coverage before final acceptance.
- F03: real HTTP tests reproduced all four missing guards; corrected login, registration and compatibility verification passed. Added expiry, wrong-answer consumption, concurrent consumption, successful registration coverage.
- F04: unit suite 167/167 passed. Real MySQL concurrent login/quota tests exposed duplicate-key shared-lock upgrades (1213 deadlock). Replaced INSERT IGNORE with no-op ON DUPLICATE KEY UPDATE to acquire an exclusive row lock; all four real login/quota integration tests then passed.
- Ruling: captcha boundary tests use actual HTTP handlers and isolated MySQL rather than duplicate mocked unit suites; backend concurrency cannot be proven by mocks.
- Ruling: support legacy `captcha` field for comments while new requests use `captchaCode`; both require direct server-side verification.

- Final acceptance: 13 Jest suites / 168 tests passed; 19 Playwright tests passed against isolated MySQL, including all three authentication forms, comments compatibility, unknown-email lockout and real concurrency.
- Typecheck passed. Lint and production build passed with 10 pre-existing Hook dependency warnings; no newly introduced lint warning remains.
- Read-only main database diff contained exactly three CREATE TABLE operations. Applied the reviewed prisma/patches/20261022_auth_phase1.sql to localhost/blog; subsequent diff is empty.
- Review: F02 request cancellation, matching image/id and object URL cleanup checked; F03 purpose checks and atomic one-time consumption checked; F04 transaction commit on bad passwords, per-email locking and allowed redirect destinations checked. New hook cleanup warning resolved. Existing forbidden page already explains the absence of management permission, so no cosmetic change was needed.
- Test harness correction: Playwright workers reload configuration with DATABASE_URL already replaced; compare against the application URL read from .env to retain the isolation check in both processes. Fixture cleanup targets owned keys instead of clearing entire counters tables.
- Final smoke initially checked a nonexistent /api/users URL; corrected the probe to the real /api/auth/users route and confirmed HTTP 200. No application change was needed.
- Local production preview retained at http://127.0.0.1:3018/login (process in the isolated worktree). Parent source checkout and its port 3000 service were not changed. Code is uncommitted on codex/admin-login-phase1; no merge/push performed.
- F01–F04 complete. Follow-up roles and email recovery remain outside phase one. Reproduction and database notes: [validation](./2026-10-22-phase1-validation.md).

## Return to dev at the user’s request

- Confirmed source and destination HEAD both equal d26ab49fceb301fdd376354bf31fba306325db8b, with no tracked edits or staged changes in dev before transfer.
- Copied 35 development files and byte-verified them against the completed worktree. Preserved the other original plans and unrelated untracked files. Updated the existing login plan only with its completed steps; the existing design document was identical.
- Copied the ignored isolated-test configuration with mode 0600. Regenerated the main workspace Prisma client; no database DDL or password reset was repeated.
- No commit, push, or merge operation was performed. Future work remains directly on dev unless the user explicitly requests otherwise.
- Validation after transfer: all 13 Jest suites / 168 tests and TypeScript passed. Browser sign-in on localhost:3000 reached /admin/dashboard, confirmed 17 permissions and HTTP 200 from /api/auth/users; test session signed out.
- The first browser probe timed out during login-page loading. A fresh browser check showed no page errors and a valid captcha; the full sign-in flow then passed using DOM readiness plus the visible captcha as the readiness condition. No business-code change was made for this probe.
- Restarted the original 3000 development service to load the newly generated Prisma client. Stopped the separate 3018 preview. The old worktree is retained only as a local backup, not the active development location.
- Final git check: dev HEAD remains d26ab49fceb301fdd376354bf31fba306325db8b; all development changes are unstaged/untracked, with no commit created.
