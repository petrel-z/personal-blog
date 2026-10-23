# 后台角色管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本次请求仅为拆分；不要因本文件存在而自动开始实施。

**Goal:** 让管理员在后台查看用户角色、分配角色、维护业务权限并创建指定角色的用户。

**Architecture:** 沿用 User、Role、Permission 及两张关联表。角色权限管理接口同时校验当前数据库 admin 身份和具体权限，授权变更与审计记录使用同一事务；沿用现有服务端即时授权。

**Tech Stack:** Next.js 14、React、Prisma/MySQL、Zod、Jest、Playwright。

**Spec:** [总体设计](../specs/2026-10-22-admin-auth-recovery-design.md)；[开发路线](./2026-10-22-admin-auth-roadmap.md)。

## Global Constraints

- 第一版只管理四个内置角色：admin 全权限、member 无后台权限，editor/reviewer 可配置业务权限。
- 只有数据库中当前 admin 可以创建后台用户、分配角色、维护角色权限；给其他角色写入管理权限码不能绕过该限制。
- 不允许并发移除最后一位有效管理员；公开注册固定 member，用户与角色一起成功或一起回滚。
- 权限修改下一次请求生效；更改角色和权限须记录操作者和变更摘要，不记录密码。
- 测试写入隔离库，沿用登录修复计划的 `playwright.auth.config.ts`。

## Review Focus

- F06：两个管理员同时移除彼此角色，最终至少保留一个未删除的 admin。
- F07：初始化命令重新运行不得恢复已由管理员撤销的 editor/reviewer 权限。
- F06/F07：未知角色、重复角色 ID、未知权限码及受保护的管理权限码不得引发部分写入。
- F08：同邮箱并发创建只成功一次，失败不得留下无角色用户，公开注册不能指定角色。
- F05/F07：已有 user:read 用户能继续读取用户列表，但不能借新增页面访问管理接口。

## File Structure

- `src/shared/roles.ts` 放角色名、说明和默认授权；`src/shared/permissions.ts` 放权限目录、中文展示和页面映射。
- `src/server/features/auth/{role,user}.service.ts` 负责角色与用户操作，复用 `src/server/auth/route.ts` 边界。
- `src/app/(admin)/admin/roles/page.tsx` 负责角色页面；用户页面复用现有 `admin/users/page.tsx`。
- 审计沿用 `AuditLog` 模型，事务内直接通过 tx.auditLog 写入；为既有审计 action 目录补充授权变更类型。

### F05：用户角色与默认角色展示

**Files:** 新增 `src/shared/roles.ts`、`src/shared/types/authorization.ts`、`src/server/features/auth/role.service.ts`、`src/app/api/auth/roles/route.ts`、`src/app/(admin)/admin/roles/page.tsx`；修改 `src/shared/permissions.ts`、`src/app/api/auth/users/route.ts`、`src/app/(admin)/admin/users/page.tsx`、`src/app/(admin)/_components/AdminSidebar.tsx`；新增 `tests/role-read.test.ts`、`tests/e2e/admin-roles.spec.ts`。

**Interfaces:** `RoleSummary = {id: string; name: string; description: string | null; memberCount: number; permissions: Permission[]}`；`listRoles(actor: Actor): Promise<RoleSummary[]>`。GET `/api/auth/roles` 返回四个内置角色；GET `/api/auth/users` 保留原字段并增加 `roles: {id: string; name: string}[]`。新增权限 `role:read`，路由 `/admin/roles` 映射该权限且服务端要求 admin。

- [ ] 失败测试断言 user:read 可读自己的授权范围内用户列表及角色名称，无 admin 的调用者不能读取角色管理详情；响应不包含 password。
- [ ] 运行 `pnpm test --runInBand tests/role-read.test.ts`，确认现有接口不满足新增字段和拒绝行为。
- [ ] 实现列表和角色页，用户无角色时显示“未分配”；共享目录使用数据库角色 ID，前端不能把展示标签当授权依据。
- [ ] 单元测试、`pnpm exec playwright test --config=playwright.auth.config.ts tests/e2e/admin-roles.spec.ts`、`pnpm typecheck` 通过，交付可查看但暂不可编辑的角色页。

### F06：分配用户角色与最后管理员保护

**Files:** 新增 `src/server/features/auth/user.service.ts`、`src/app/api/auth/users/[id]/roles/route.ts`；修改用户页、`src/shared/permissions.ts`、`src/server/auth/route.ts`、`src/server/features/audit-log/audit-log.service.ts`；新增 `tests/user-role.test.ts`、`tests/integration/admin-membership.spec.ts`。

**Interfaces:** `replaceUserRoles(actor: Actor, userId: string, roleIds: string[]): Promise<void>`；PATCH `/api/auth/users/:id/roles` 请求 `{roleIds: string[]}`。新增 `user:assign-role`。`withAdminPermission<Context>(permission: Permission, handler: (request: Request, context: Context, actor: Actor) => Promise<Response>)` 复用 withPermission 并额外校验 actor.isAdmin。

- [ ] 失败用例覆盖非 admin 403、未知／重复角色 400、已删除账号拒绝、最后 admin 拒绝、审计失败全部回滚；真实库并发用例断言两个移除请求至多一个成功。
- [ ] 运行 `pnpm test --runInBand tests/user-role.test.ts`，确认预期失败。
- [ ] 实现角色选择和确认保存；所有 admin 成员增删事务先锁同一 admin Role 行，再核对操作者当前 admin 身份和有效成员数量，最后替换关系并写审计，保持一致锁顺序。
- [ ] 单元、浏览器角色选择回归及 `pnpm exec playwright test --config=playwright.auth.config.ts tests/integration/admin-membership.spec.ts` 通过；确认已有登录用户下一次请求按新角色授权。

### F07：配置编辑者与审核者权限

**Files:** 新增 `src/app/api/auth/roles/[id]/permissions/route.ts`；修改角色页、`src/server/features/auth/role.service.ts`、`src/shared/permissions.ts`、`scripts/setup-auth.ts`；新增 `tests/role-permissions.test.ts`，扩展 `tests/setup-auth.test.ts`、`tests/integration/admin-membership.spec.ts`。

**Interfaces:** `replaceRolePermissions(actor: Actor, roleId: string, codes: Permission[]): Promise<void>`；PATCH `/api/auth/roles/:id/permissions` 请求 `{permissions: Permission[]}`。新增 `role:update`；复用 F06 `withAdminPermission`。editor/reviewer 可选现有业务权限，排除 `role:read`、`role:update`、`user:create`、`user:assign-role`；后两项由 F08/F06 增加。

- [ ] 失败测试：admin/member 权限不可更改；unknown code 拒绝；禁用 editor 的 post:update 后同一会话下一次请求拒绝；再次 setup 不恢复被撤销的权限。
- [ ] 运行 `pnpm test --runInBand tests/role-permissions.test.ts tests/setup-auth.test.ts tests/authorization.test.ts`，确认新增行为先失败。
- [ ] 实现分组勾选与保存；事务内重新核对 admin 身份、更新授权及审计。初始化只给新建角色写默认业务授权，已有 editor/reviewer 授权保持原样；admin 的有效权限始终由完整权限目录决定。
- [ ] 测试通过，浏览器验证刷新后权限仍保存；验证空业务权限会清楚显示不能进入后台，角色页没有删除 admin/member 或编辑其权限的操作。

### F08：后台新增用户及指定角色

**Files:** 修改 `src/app/api/auth/users/route.ts`、`src/server/features/auth/user.service.ts`、`src/app/(admin)/admin/users/page.tsx`、`src/app/api/auth/register/route.ts`、`src/shared/permissions.ts`；新增 `tests/admin-user-create.test.ts`、`tests/integration/user-registration.spec.ts`。

**Interfaces:** `createManagedUser(actor: Actor, input: {name: string; email: string; password: string; roleIds: string[]}): Promise<{id: string; email: string}>`；POST `/api/auth/users` 使用同结构。新增 `user:create`，仅 admin 可用。公共 `/api/auth/register` 不接受 roleIds，固定 member。

- [ ] 失败用例覆盖非 admin 创建拒绝、用户与角色事务原子性、同邮箱并发只有一次成功、公共注册传入管理员角色无效；拒绝已删除账号使用的同一邮箱复用。
- [ ] 运行 `pnpm test --runInBand tests/admin-user-create.test.ts`，确认现有后台表单仍调用公开注册的缺口。
- [ ] 后台表单改用受保护创建接口，支持选择角色；公开注册改成原子创建用户和 member 关联。新建邮箱按 F04 `normalizeEmail` 归一化，不批量重写已有邮箱；密码 bcrypt 哈希校验实际 UTF-8 字节长度不超过 72 字节。
- [ ] 单元、真实库并发及浏览器创建用户回归通过；返回值、审计和日志不含明文或密码哈希；独立审阅 F08。

## 阶段验收

用隔离账号验证游客/member/editor/reviewer/admin 页面和 API。运行 `pnpm test --runInBand`、`pnpm typecheck`、`pnpm lint`、`pnpm build`；记录已完成 F05–F08 与真实并发验证证据，保护现有开发服务。
