# 后台角色管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 当前侧聊禁止子代理，按顺序自行实施与检查。2026-10-23 用户要求先完成 F05.1、不提交；F05.1 已完成并保留未提交修改，其余五项尚未开始，不自动继续实施。

**Goal:** 让管理员在后台查看用户角色、分配角色、维护业务权限并创建指定角色的用户。

**Architecture:** 沿用 User、Role、Permission 及两张关联表。角色权限管理接口同时校验当前数据库 admin 身份和具体权限，授权变更与审计记录使用同一事务；沿用现有服务端即时授权。

**Tech Stack:** Next.js 14、React、Prisma/MySQL、Zod、Jest、Playwright。

**Spec:** [总体设计](../specs/2026-10-22-admin-auth-recovery-design.md)；[开发路线](./2026-10-22-admin-auth-roadmap.md)。

## 当前基线与交付顺序

阶段一已提交至 `dev`：`2588abb`。保留现有 Next.js、Auth.js 和五张 RBAC 表，本阶段预计无需数据库结构变更。沿用四个内置角色的方案，不增加自定义角色的创建、删除或重命名，也不包含阶段三密码找回。

| 顺序 | 小功能 | 用户可验收的结果 | 依赖 |
| --- | --- | --- | --- |
| F05.1（已完成，未提交） | 统一角色、权限目录和管理边界 | 四种角色规则一致；初始化不覆盖已配置授权；仅 admin 能管理授权 | 阶段一 |
| F05.2 | 用户列表展示角色 | 每个用户显示一个或多个中文角色标签，无角色显示“未分配” | F05.1 |
| F05.3 | 角色列表与权限展示 | 新增“角色管理”入口，展示说明、有效成员数量、按模块分组的权限 | F05.1 |
| F06 | 为用户分配角色 | 管理员勾选角色并保存；最后一位有效管理员不能被移除；写入审计 | F05.2、F05.3 |
| F07 | 配置角色业务权限 | 可修改 editor/reviewer 的权限；保存后下一次请求生效；写入审计 | F05.3、F06 的事务保护 |
| F08 | 后台创建指定角色用户 | 创建时选择角色，账号与角色一起成功；当前管理员保持登录；写入审计 | F06 |

按表格顺序交付，每项包含必要的前端、服务端和验收，不拆成只能展示但没有鉴权的半成品。F05.2 与 F05.3 在接口确定后逻辑上独立；本侧聊按顺序实施。

## Global Constraints

- 第一版只管理四个内置角色：admin 全权限、member 无后台权限，editor/reviewer 可配置业务权限。
- 只有数据库中当前 admin 可以创建后台用户、分配角色、维护角色权限；给其他角色写入管理权限码不能绕过该限制。
- 不允许并发移除最后一位有效管理员；公开注册固定 member，用户与角色一起成功或一起回滚。
- 权限修改下一次请求生效；更改角色和权限须记录操作者和变更摘要，不记录密码。
- 测试写入隔离库，沿用登录修复计划的 `playwright.auth.config.ts`。
- 公开注册的自动登录、成功不重新取验证码、跳转首页继续保留；`auth.ts` 的 registration provider 与 `/api/auth/register` 共用现有 `registerMember`，不得再复制一套注册业务。
- 后台新增用户改用受保护接口，不调用公开注册 provider，不改变管理员会话；后台表单不再要求公开注册图片验证码。
- UI 的管理入口与服务端一致：非 admin 即使被错误写入管理权限码，也不显示管理按钮且不能调用管理接口。`user:read` 仍允许读取用户基本资料和角色标签。
- `admin`、`member` 权限只读；同时有多个角色时取有效权限并集。分配角色允许空数组（撤销全部角色），创建用户必须选择至少一个角色；这些是本次拆解的实现默认值。

## Review Focus

- F06：两个管理员同时移除彼此角色，最终至少保留一个未删除的 admin。
- F05.1/F07：初始化命令重新运行不得恢复已由管理员撤销的 editor/reviewer 权限。
- F06/F07：未知角色、重复角色 ID、未知权限码及受保护的管理权限码不得引发部分写入。
- F08：同邮箱并发创建只成功一次，失败不得留下无角色用户；两个公开注册入口均不能指定角色，后台创建不得替换操作者会话。
- F05/F07：已有 user:read 用户能继续读取用户列表，但不能借新增页面访问管理接口。

## File Structure

- `src/shared/roles.ts` 放角色名、说明和默认授权；`src/shared/permissions.ts` 放权限目录、中文展示和页面映射。
- `src/server/features/auth/{role,user}.service.ts` 负责角色与用户操作，复用 `src/server/auth/route.ts` 边界。
- `src/app/(admin)/admin/roles/page.tsx` 负责角色页面；用户页面复用现有 `admin/users/page.tsx`。
- 审计沿用 `AuditLog` 模型，事务内直接通过 tx.auditLog 写入；为既有审计 action 目录补充授权变更类型。
- `src/server/auth/access.ts` 继续按数据库当前角色计算权限；管理权限过滤和管理员校验在此处集中定义，API 包装器复用它。
- 浏览器与数据库用例放在 `tests/integration/`，沿用现有 auth 测试配置的匹配规则；不把新测试放进配置不会运行的目录。

### F05.1：统一目录、初始化和管理员边界

**Files:** 新增 `src/shared/roles.ts`、`src/shared/types/authorization.ts`；修改 `src/shared/permissions.ts`、`src/server/auth/access.ts`、`src/server/auth/route.ts`、`scripts/setup-auth.ts`；扩展 `tests/authorization.test.ts`、`tests/setup-auth.test.ts`。

**Interfaces:** `BuiltinRoleName = 'admin' | 'editor' | 'reviewer' | 'member'`；`ROLE_DEFINITIONS` 提供中文名、说明和首次初始化默认授权；`PERMISSION_DEFINITIONS` 提供权限码、中文名和模块；新增 `role:read`、`role:update`、`user:create`、`user:assign-role` 四个管理权限。`requireAdminPermission(permission: Permission): Promise<Actor>` 和 `withAdminPermission<Context>(permission: Permission, handler: (request: Request, context: Context, actor: Actor) => Promise<Response>)` 校验当前数据库 admin 身份及对应权限。

- [x] 写失败测试：非 admin 即使拥有四个管理权限码也被拒绝；admin 自动获得完整目录；member 角色不贡献后台权限；重复 setup 不恢复 editor/reviewer 已撤销的权限，不重设账号密码。
- [x] 运行 `pnpm test --runInBand tests/authorization.test.ts tests/setup-auth.test.ts`，确认新增规则失败。
- [x] 将现有默认角色配置收拢到共享目录；setup 只给首次创建的 editor/reviewer 写默认业务授权，已存在角色保持配置；有效权限计算中过滤非 admin 的管理权限码及 member 的后台授权。未知的旧角色不被删除，沿用其现有业务授权。
- [x] 实现共用管理员边界：游客 401、非 admin 403，鉴权先于解析业务参数；成功和拒绝响应均 `private, no-store`。
- [x] 同组测试与 `pnpm exec tsc --noEmit --incremental false` 通过，核对角色目录与权限目录一致，形成可审阅交付。

**执行记录（2026-10-23，基线 2588abb）：**

- 范围按用户指令限定 F05.1，直接在当前 dev 工作区修改，不创建提交；沿用当前侧聊禁止子代理的约束并完成自审。
- 权限码由带中文标签、模块和管理员标记的目录推导，避免维护重复列表；角色默认授权由共享目录提供。角色默认授权通过 Prisma upsert 的嵌套 create 写入，已有角色的 update 为空，因此不会恢复已撤销的权限或覆盖说明。
- 默认授权与重复初始化改用 `tests/integration/setup-auth.spec.ts` 在真实隔离 MySQL 中验证；用外层回滚事务恢复所有测试角色与账号数据。原 mock 用例保留目标账号与拒绝场景检查。
- RED：授权测试 11 项按预期失败；两项真实库用例分别复现撤销权限被恢复、缺少新增管理权限。GREEN：授权与初始化单元测试 24 项通过，两项真实库用例通过。
- 完整回归：Jest 13 套 / 180 项通过；认证 Playwright / 隔离 MySQL 25 项通过；TypeScript、本次修改文件 ESLint、差异格式检查通过。
- 测试使用临时副本和 3017 端口，与现有开发服务的 `.next` 隔离；未在应用数据库上运行初始化脚本。最终检查为作者自审，没有独立审阅者。

### F05.2：用户列表展示角色

**Files:** 修改 `src/app/api/auth/users/route.ts`、`src/app/(admin)/admin/users/page.tsx`；新增 `tests/user-role-read.test.ts`、`tests/integration/admin-roles.spec.ts`。

**Interfaces:** GET `/api/auth/users` 保留原字段与 `user:read` 边界，增加 `roles: {id: string; name: string}[]`；标签使用 F05.1 的中文目录，未知旧角色回退显示原名，不静默丢弃。

- [ ] 写失败测试：具有 user:read 的非 admin 可以读取角色标签；无权限拒绝；无角色返回空数组；响应不含 password 或密码哈希。
- [ ] 运行 `pnpm test --runInBand tests/user-role-read.test.ts`，确认原接口缺少角色字段。
- [ ] 查询用户时选取角色 ID/名称，用户表格增加角色列，支持多标签、“未分配”和未知旧角色名称；不把中文显示名当授权依据。
- [ ] 同组单元测试及 `pnpm exec playwright test --config=playwright.auth.config.ts tests/integration/admin-roles.spec.ts` 通过，验收管理员与只读用户两个视角。

### F05.3：角色列表与权限详情

**Files:** 新增 `src/server/features/auth/role.service.ts`、`src/app/api/auth/roles/route.ts`、`src/app/(admin)/admin/roles/page.tsx`、`src/app/(admin)/admin/roles/_components/RoleManager.tsx`；修改 `src/shared/permissions.ts`、`src/app/(admin)/_components/AdminSidebar.tsx`；新增 `tests/role-read.test.ts`，扩展 `tests/integration/admin-roles.spec.ts`。

**Interfaces:** `RoleSummary = {id: string; name: BuiltinRoleName; description: string | null; memberCount: number; permissions: Permission[]}`；`listRoles(actor: Actor): Promise<RoleSummary[]>`；GET `/api/auth/roles` 返回数据库内四种内置角色，缺少默认数据时显示需初始化的提示，读取不得自动创建角色。`/admin/roles` 映射 `role:read`；页面服务端入口也调用 `requireAdminPermission`。

- [ ] 写失败测试：仅 admin 能读取角色详情；有效成员数不计已删除用户；admin 展示完整权限、member 展示无后台权限；缺失角色不产生数据库写入。
- [ ] 运行 `pnpm test --runInBand tests/role-read.test.ts`，确认预期失败。
- [ ] 实现角色查询和“角色管理”菜单，展示中文说明、成员数及分组权限；admin/member 明确只读，业务权限编辑按钮在 F07 接入。
- [ ] 同组单元测试、角色浏览器测试及类型检查通过，验证非 admin 直接访问页面和 API 都被拒绝。

### F06：分配用户角色与最后管理员保护

**Files:** 新增 `src/server/features/auth/user.service.ts`、`src/server/features/auth/admin-transaction.ts`、`src/app/api/auth/users/[id]/roles/route.ts`；修改用户页、`src/server/features/audit-log/audit-log.service.ts`、`src/app/(admin)/admin/audit-logs/page.tsx`；新增 `tests/user-role.test.ts`、`tests/integration/admin-membership.spec.ts`，扩展角色浏览器测试。

**Interfaces:** `replaceUserRoles(actor: Actor, userId: string, roleIds: string[]): Promise<void>`；PATCH `/api/auth/users/:id/roles` 请求 `{roleIds: string[]}`，只接受零到四个不重复的内置角色 ID；沿用 F05.1 的 `withAdminPermission('user:assign-role', ...)`。`withAdminTransaction<T>(actor: Actor, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>` 统一锁定 admin Role 行并在事务中复核操作者仍为有效 admin，供 F06–F08 的所有管理写入复用。

- [ ] 失败用例覆盖非 admin 403、未知／重复角色 400、已删除或不存在账号 404、最后 admin 409、普通用户可清空角色、审计失败全部回滚；真实库并发用例断言两个移除请求至多一个成功。
- [ ] 运行 `pnpm test --runInBand tests/user-role.test.ts`，确认预期失败。
- [ ] 实现角色选择和确认保存；所有管理写入先锁同一 admin Role 行，再核对操作者当前 admin 身份和有效成员数量，最后替换关系并写 `USER_ROLE_UPDATE` 审计，包含角色变更前后值；补齐审计页中文动作名。
- [ ] 单元、浏览器角色选择回归及 `pnpm exec playwright test --config=playwright.auth.config.ts tests/integration/admin-membership.spec.ts` 通过；确认已有登录用户下一次请求按新角色授权。

### F07：配置编辑者与审核者权限

**Files:** 新增 `src/app/api/auth/roles/[id]/permissions/route.ts`；修改 `RoleManager.tsx`、`src/server/features/auth/role.service.ts`、审计动作目录与审计页中文动作名；新增 `tests/role-permissions.test.ts`，扩展 `tests/setup-auth.test.ts`、`tests/integration/admin-membership.spec.ts` 和角色浏览器测试。

**Interfaces:** `replaceRolePermissions(actor: Actor, roleId: string, codes: Permission[]): Promise<void>`；PATCH `/api/auth/roles/:id/permissions` 请求 `{permissions: Permission[]}`，沿用 F05.1 的 `role:update` 边界及 F06 的 `withAdminTransaction`。editor/reviewer 可选现有业务权限，排除四项管理权限；空数组表示撤销该角色全部后台业务权限，重复或未知码返回 400。

- [ ] 失败测试：admin/member 权限不可更改；unknown code 拒绝；禁用 editor 的 post:update 后同一会话下一次请求拒绝；再次 setup 不恢复被撤销的权限。
- [ ] 运行 `pnpm test --runInBand tests/role-permissions.test.ts tests/setup-auth.test.ts tests/authorization.test.ts`，确认新增行为先失败。
- [ ] 实现分组勾选与保存；事务内重新核对 admin 身份、更新授权并写 `ROLE_PERMISSION_UPDATE` 审计。初始化沿用 F05.1 的不覆盖规则；admin 的有效权限始终由完整权限目录决定。保存后刷新角色数据；操作者若更新自己的授权展示，刷新服务端页面数据。
- [ ] 测试通过，浏览器验证刷新后权限仍保存；验证空业务权限会清楚显示不能进入后台，角色页没有删除 admin/member 或编辑其权限的操作。

### F08：后台新增用户及指定角色

**Files:** 修改 `src/app/api/auth/users/route.ts`、`src/server/features/auth/user.service.ts`、`src/app/(admin)/admin/users/page.tsx`、审计动作目录与审计页中文动作名；按需提取共用账号输入校验供 `registration.service.ts` 复用；新增 `tests/admin-user-create.test.ts`，扩展 `tests/integration/registration.spec.ts`、`tests/integration/forms-compatibility.spec.ts`。

**Interfaces:** `createManagedUser(actor: Actor, input: {name: string; email: string; password: string; roleIds: string[]}): Promise<{id: string; email: string}>`；POST `/api/auth/users` 使用同结构，要求一到四个不重复的内置角色 ID，沿用 `user:create` 管理员边界和 `withAdminTransaction`。两个公开注册入口固定 member，客户端传入的 roleIds 不生效。

- [ ] 失败用例覆盖非 admin 创建拒绝、用户与角色及审计事务原子性、同邮箱并发只有一次成功、空／未知／重复角色拒绝、两个公开注册入口传入管理员角色均无效；拒绝已删除账号使用的同一邮箱复用。
- [ ] 运行 `pnpm test --runInBand tests/admin-user-create.test.ts`，确认现有后台表单仍调用公开注册的缺口。
- [ ] 后台表单改用受保护创建接口，默认选择 member 并允许多选角色；移除后台表单的公开注册验证码依赖。事务内创建账号、关联角色和 `USER_CREATE` 审计。公开注册继续复用已经具备事务的 `registerMember`，保持自动登录；新建邮箱归一化，不批量重写已有邮箱；密码 bcrypt 哈希前校验实际 UTF-8 字节长度不超过 72 字节，前端和服务端提示一致。
- [ ] 单元、真实库并发及浏览器创建用户回归通过；确认后台创建后仍为管理员会话、公开注册自动登录且不再取码；返回值、审计和日志不含明文或密码哈希。

## 阶段验收

用隔离账号验证游客/member/editor/reviewer/admin 页面和 API。运行 `pnpm test --runInBand`、`pnpm exec playwright test --config=playwright.auth.config.ts`、`pnpm exec tsc --noEmit --incremental false`、`pnpm lint`、`pnpm build`；记录完成项、审计与真实并发验证证据。测试和构建沿用阶段一临时副本策略，不与现有开发服务共用 `.next`，不对应用库执行破坏性初始化。每个小功能通过测试并自审后形成独立可提交变更，提交仍按用户当时指令执行。
