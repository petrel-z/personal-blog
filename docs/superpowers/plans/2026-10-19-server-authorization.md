# Server Authorization Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track verification below.

**Goal:** Enforce current server-side identity, operation permissions and article ownership before every administrative operation.

**Architecture:** Reuse the existing User/Role/Permission schema. Resolve a fresh actor from the database on each protected request; route wrappers deny unauthenticated/unauthorized requests before parsing bodies or performing side effects. Article services additionally enforce ownership and publication rules. Public reads remain public; administrative reads require permissions. Server-rendered admin layout and permission-aware navigation complement the API boundary.

**Tech Stack:** Next.js 14, Auth.js JWT sessions, Prisma/MySQL, TypeScript, Jest with next/jest.

**Spec:** User-approved analysis in this chat; doc/design/technical-design.md section 4.3 and doc/design/requirement-back.md section 5.1.

## Global Constraints

- HTTP 401 for absent/invalid/deleted identities; HTTP 403 for insufficient permission; preserve JSON business codes 4010/4030.
- Existing admin role grants all known administrative permissions. Other roles use current RolePermission records; members receive no management permissions by default.
- Editors may operate only on their own articles. Publishing or modifying already-published content requires post:publish.
- No automatic administrator promotion, credential changes, deployment or production data mutation.
- Keep existing unrelated user files. Work in the current dev checkout; user authorized implementation of the reviewed proposal.
- Public comments privacy, dependency upgrades and unrelated functional defects are separate review findings and outside this repair.

## Review Focus

- Permission revocation/deleted users with still-valid JWTs must lose access on the next request.
- Combined create/update-and-publish operations and edits of already-published content must require publication permission.
- Direct requests bypassing admin pages must be denied without database/file side effects.
- Shared public/admin article endpoints must not leak drafts or hide all drafts from authorized editors.
- Audit log actors must be server-derived; callers cannot write arbitrary audit records.

### Task 1: Authorization and route regression harness

**Files:** jest.config.cjs, tests/authorization.test.ts, tests/admin-routes.test.ts, src/shared/permissions.ts, src/server/auth/{access,route}.ts, auth.ts, package.json.
**Interfaces:** getActor(): Promise<Actor|null>; requirePermission(permission): Promise<Actor>; assertPermission(actor, permission): void; withPermission(permission, handler): route handler; accessErrorResponse(error): Response|undefined.
- [x] Install Jest/type declarations; use next/jest and mock only external identity/database/storage boundaries.
- [x] Run failing route tests: anonymous settings update and article edit must return 401 before effects; members must return 403.
- [x] Implement shared permission checks, current-user verification and error mapping.
- [x] Cover revoked/deleted identity, database failure, explicit grants and administrator access.

### Task 2: Management routes and article resources

**Files:** src/app/api/**/route.ts, src/server/features/post/{post.service,post.types}.ts, tests/admin-routes.test.ts, tests/post-authorization.test.ts.
**Interfaces:** Article create/update/delete consume Actor; getPosts(params, actor?) accepts admin scope and restricts non-admins to owned records.
- [x] Add failing tests for every management HTTP method and publication/ownership bypass.
- [x] Wrap management APIs; distinguish approve/reject permissions; remove caller-authored audit POST.
- [x] Enforce article permissions in services and protect draft previews/admin lists; check target visibility before tracking views.
- [x] Verify visitor/member denial, permitted requests, public-read compatibility and no side effects on denial.

### Task 3: Admin UI, initialization and delivery

**Files:** src/app/(admin)/layout.tsx, src/app/(admin)/_components/*, administrative pages, src/app/forbidden/page.tsx, scripts/setup-auth.ts, doc/dev/authorization.md, .github/workflows/deploy.yml.
- [x] Test server admin access and bootstrap behavior before implementation.
- [x] Move layout interaction into a client shell; check server actor before rendering; expose current permissions to UI and filter navigation/actions.
- [x] Add idempotent role/permission initialization with explicit existing administrator email; document safe rollout and current empty-role inventory.
- [x] Add authorization suite to CI; run complete tests, typecheck, lint and build.
- [x] Request one independent read-only review, resolve actionable findings and report results/limits.

## Execution Ledger

- Baseline: no tracked modifications; TypeScript passed, lint had 10 existing Hook warnings, Jest was missing, Playwright had no tests (prior review).
- Read-only database inventory: Role table returned zero records. No privileges or other data changed.
- Ruling: implement inline in existing checkout and keep changes reviewable without commits; execution already authorized by the user. No repeated approval gate.

- Implementation complete: 21 management methods use a shared request guard; article lists/previews enforce read scope and ownership. Audit POST removed; server admin layout and UI permissions added.
- Review findings resolved: nested article tag creation now requires tag:manage; read-only users retain article titles. Independent deletion authority remains post:delete (own articles for non-admins), documented explicitly.
- Additional regressions covered: draft publication during an update cannot bypass publication permission; public article response retains incremented view count; deleted accounts cannot log in; identity-dependent responses are not cached.
- Setup script uses TypeScript with tsx to reuse the typed permission catalog. --help verified without connecting or changing data. No account was granted admin during this task.
- Final validation (2026-10-19): 6 suites / 82 tests passed; typecheck passed; final production build passed with the same 10 existing Hook warnings and an outdated Browserslist notice; git diff --check passed.
- Production-mode HTTP smoke: 23 anonymous management requests returned HTTP 401 / code 4010 / private,no-store; /admin/posts redirected to /login (307); audit POST returned 405; public posts/categories/tags/settings returned HTTP 200 / code 2000. Temporary server stopped afterward.
- Validation limits: authenticated roles and allowed writes were tested using real handlers/services with mocked session/database/storage boundaries. No real-database authenticated write test or administrator bootstrap was performed.
- Smoke-test configuration correction: existing NEXTAUTH_URL-only production configuration produced Auth.js UntrustedHost. Repeated all HTTP checks with explicit process-local AUTH_URL=http://127.0.0.1:3011; session endpoint returned 200/null and server logs contained no auth errors. Updated .env.example and rollout instructions to use AUTH_URL; existing .env was not edited. Final temporary server stopped.
- Commit preparation (2026-10-20): user requested committing the completed fix on dev. Retained withPermission; the proposed route factory refactor was cancelled. Re-ran all 82 tests, typecheck and lint successfully (the same 10 existing Hook warnings); unrelated workspace changes are excluded from the commit.
