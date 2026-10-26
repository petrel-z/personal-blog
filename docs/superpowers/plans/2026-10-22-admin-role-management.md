# 后台角色管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 当前侧聊禁止子代理，按顺序自行实施与检查。2026-10-26 用户要求“提交并继续”；F05.1 已提交为 `473a0f5`，F05.2 已提交为 `ccbece7`，F05.3 已提交为 `091daaf`；F06 已提交为 `82dca4b`，F07 已完成并验收、尚未提交，F08 尚未开始。

**Goal:** 让管理员在后台查看用户角色、分配角色、维护业务权限并创建指定角色的用户。

**Architecture:** 沿用 User、Role、Permission 及两张关联表。角色权限管理接口同时校验当前数据库 admin 身份和具体权限，授权变更与审计记录使用同一事务；沿用现有服务端即时授权。

**Tech Stack:** Next.js 14、React、Prisma/MySQL、Zod、Jest、Playwright。

**Spec:** [总体设计](../specs/2026-10-22-admin-auth-recovery-design.md)；[开发路线](./2026-10-22-admin-auth-roadmap.md)。

## 当前基线与交付顺序

阶段一已提交至 `dev`：`2588abb`。保留现有 Next.js、Auth.js 和五张 RBAC 表，本阶段预计无需数据库结构变更。沿用四个内置角色的方案，不增加自定义角色的创建、删除或重命名，也不包含阶段三密码找回。

| 顺序 | 小功能 | 用户可验收的结果 | 依赖 |
| --- | --- | --- | --- |
| F05.1（已提交 473a0f5） | 统一角色、权限目录和管理边界 | 四种角色规则一致；初始化不覆盖已配置授权；仅 admin 能管理授权 | 阶段一 |
| F05.2（已提交 ccbece7） | 用户列表展示角色 | 每个用户显示一个或多个中文角色标签，无角色显示“未分配” | F05.1 |
| F05.3（已提交 091daaf） | 角色列表与权限展示 | 新增“角色管理”入口，展示说明、有效成员数量、按模块分组的权限 | F05.1 |
| F06（已提交 82dca4b） | 为用户分配角色 | 管理员勾选角色并保存；最后一位有效管理员不能被移除；写入审计 | F05.2、F05.3 |
| F07（已验收，待提交） | 配置角色业务权限 | 可修改 editor/reviewer 的权限；保存后下一次请求生效；写入审计 | F05.3、F06 的事务保护 |
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

- [x] 写失败测试：具有 user:read 的非 admin 可以读取角色标签；无权限拒绝；无角色返回空数组；响应不含 password 或密码哈希。
- [x] 运行 `pnpm test --runInBand tests/user-role-read.test.ts`，确认原接口缺少角色字段。
- [x] 查询用户时选取角色 ID/名称，用户表格增加角色列，支持多标签、“未分配”和未知旧角色名称；不把中文显示名当授权依据。
- [x] 同组单元测试及 `pnpm exec playwright test --config=playwright.auth.config.ts tests/integration/admin-roles.spec.ts` 通过，验收管理员与只读用户两个视角。

**执行记录（2026-10-23，基线 473a0f5）：**

- 用户要求提交已有代码并继续开发，已将 F05.1 提交为 `473a0f5`；沿用逐个小功能验收方式，本次完成 F05.2，新增修改保留未提交。
- 入口保持 `/admin/users` → GET `/api/auth/users`，沿用 `user:read`；数据库只选取角色 ID/名称，返回平铺的 roles 数组，保留原用户字段，过滤已删除用户，不返回密码或角色权限详情。角色按名称排序；前端复用共享中文目录，支持多标签、无角色和未知旧角色原名。
- Ruling：查询失败原先返回 HTTP 200，且客户端会忽略业务失败；本次一并改为 HTTP 500、显示错误并清空过期列表，空态区分不可用与暂无用户。这属于角色读取链路的异常验收；影响仅限列表请求失败时的表现。
- RED：5 项新增单元测试中 3 项按预期失败（两种授权读者缺少 roles、数据库失败返回 200）；3 项新增集成测试中两种读者的页面用例因缺少角色列失败，未授权读取用例通过。
- GREEN：新增 5 项单元测试及 3 项真实 MySQL／浏览器测试通过；完整 Jest 14 套 / 185 项、认证 Playwright 28 项通过，包含注册自动登录与验证码回归。TypeScript、本次代码文件 ESLint、差异格式检查通过。
- 浏览器用例覆盖管理员、仅有 user:read 的非管理员、多角色、普通会员、未分配、旧角色名称、已删除用户过滤、响应字段白名单、401/403，以及接口错误可见；测试在临时副本和隔离数据库执行，未修改应用数据库。完成作者自审；当前侧聊不使用子代理。

### F05.3：角色列表与权限详情

**Files:** 新增 `src/server/features/auth/role.service.ts`、`src/app/api/auth/roles/route.ts`、`src/app/(admin)/admin/roles/page.tsx`、`src/app/(admin)/admin/roles/_components/RoleManager.tsx`；修改 `src/shared/permissions.ts`、`src/shared/roles.ts`、`src/shared/types/authorization.ts`、`src/server/auth/access.ts`、`src/app/(admin)/_components/AdminSidebar.tsx`；新增 `tests/role-read.test.ts`，扩展 `tests/integration/admin-roles.spec.ts`。

**Interfaces:** `RoleSummary = {id: string; name: BuiltinRoleName; description: string | null; memberCount: number; permissions: Permission[]}`；`listRoles(actor: Actor): Promise<RoleSummary[]>`；GET `/api/auth/roles` 返回数据库内四种内置角色，缺少默认数据时显示需初始化的提示，读取不得自动创建角色。`/admin/roles` 映射 `role:read`；页面服务端入口也调用 `requireAdminPermission`。

- [x] 写失败测试：仅 admin 能读取角色详情；有效成员数不计已删除用户；admin 展示完整权限、member 展示无后台权限；缺失角色不产生数据库写入。
- [x] 运行 `pnpm test --runInBand tests/role-read.test.ts`，确认预期失败。
- [x] 实现角色查询和“角色管理”菜单，展示中文说明、成员数及分组权限；admin/member 明确只读，业务权限编辑按钮在 F07 接入。
- [x] 同组单元测试、角色浏览器测试及类型检查通过，验证非 admin 直接访问页面和 API 都被拒绝。

**执行记录（2026-10-23，基线 ccbece7）：**

- 按用户“提交，然后继续”指令，将 F05.2 提交为 `ccbece7`，完成下一项 F05.3；新增修改保留未提交，F06–F08 尚未开始。
- 角色菜单通过 role:read 页面映射显示；页面服务端 requireAdminPermission 和 API withAdminPermission 分别验证当前数据库管理员身份。GET /api/auth/roles 调用 listRoles，只返回已存在的四种内置角色、说明、未删除成员数和有效权限，查询不补建角色或回填授权。
- Ruling：从 getActor 提取 getEffectiveRolePermissions，供鉴权和角色详情共用，防止两处计算规则分叉。保持已有规则：admin 完整目录、member 空权限，其他角色过滤未知码和管理权限；getActor 仍取多个角色的有效权限并集，兼容旧角色。
- 页面支持切换角色、按模块展示权限、空权限说明、缺失角色提示以及失败重试；admin/member 显示权限只读。只展示现有角色数据，不提前提供尚未接入的编辑按钮。
- RED：新增角色接口尚不存在时落入 Auth.js 通配路由，3 项新增真实库／浏览器用例因 HTTP 400 失败；新增单元测试最初因实现模块缺失未能运行。实现后新增 8 项单元测试通过，连同已有授权／跳转测试共 39 项通过。
- 浏览器初验发现测试中的 alert 同时匹配 Next.js 路由播报节点，已将定位限定到 main。另经 trace 确认服务器已输出 /forbidden 的拒绝跳转，但现有 AuthProvider 可以先显示无权限视图，令网址保留原路径。Ruling：验收页面实际拒绝、角色组件和数据请求未加载，不强制固定落地 URL；保留现有后台无权限交互，API 仍必须实际返回 401/403，页面单元测试独立核对服务端边界。
- 最终完整回归：Jest 15 套 / 193 项通过；认证 Playwright / 隔离 MySQL 31 项通过；TypeScript、本次文件 ESLint、差异格式检查通过。新增集成用例验证错误授予的管理权限不可用、成员数排除软删除用户、缺失角色读取不创建数据、请求失败和重试，以及菜单和直达访问边界。
- 已查看真实浏览器截图并完成作者自审；测试使用临时副本与隔离数据库，未修改应用数据库，未使用子代理。

### F06：分配用户角色与最后管理员保护

**Files:** 新增 `src/server/features/auth/user.service.ts`、`src/server/features/auth/admin-transaction.ts`、`src/app/api/auth/users/[id]/roles/route.ts`、`src/app/(admin)/admin/users/_components/UserRoleEditor.tsx`；修改用户页、`src/server/features/audit-log/audit-log.service.ts`、`src/app/(admin)/admin/audit-logs/page.tsx`；新增 `tests/user-role.test.ts`、`tests/integration/admin-membership.spec.ts`，扩展角色浏览器测试。

**Interfaces:** `replaceUserRoles(actor: Actor, userId: string, roleIds: string[]): Promise<void>`；PATCH `/api/auth/users/:id/roles` 请求 `{roleIds: string[]}`，只接受零到四个不重复的内置角色 ID；沿用 F05.1 的 `withAdminPermission('user:assign-role', ...)`。`withAdminTransaction<T>(actor: Actor, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>` 统一锁定 admin Role 行并在事务中复核操作者仍为有效 admin，供 F06–F08 的所有管理写入复用。

- [x] 失败用例覆盖非 admin 403、未知／重复角色 400、已删除或不存在账号 404、最后 admin 409、普通用户可清空角色、审计失败全部回滚；真实库并发用例断言两个移除请求至多一个成功。
- [x] 运行 `pnpm test --runInBand tests/user-role.test.ts`，确认预期失败。
- [x] 实现角色选择和确认保存；所有管理写入先锁同一 admin Role 行，再核对操作者当前 admin 身份和有效成员数量，最后替换关系并写 `USER_ROLE_UPDATE` 审计，包含角色变更前后值；补齐审计页中文动作名。
- [x] 单元、浏览器角色选择回归及 `pnpm exec playwright test --config=playwright.auth.config.ts tests/integration/admin-membership.spec.ts` 通过；确认已有登录用户下一次请求按新角色授权。

**执行记录（2026-10-26，基线 091daaf）：**

- 按用户“提交并继续”指令，在 dev 将 F05.3 提交为 `091daaf`，提交前复跑 193 项单元测试和 TypeScript 检查；随后完成 F06。沿用逐项验收方式，F06 修改保留工作区，未开始 F07/F08。
- 用户列表仅对管理员显示“分配角色”，弹窗允许多选或清空，包含加载失败重试、旧角色移除说明、撤销自身管理员的提示和保存失败保留选项。成功后刷新列表和服务端权限；撤销自身管理员不会替换或退出当前登录会话。
- PATCH 接口在解析请求前校验 admin 身份与 user:assign-role；服务层再次验证输入和身份。ReadCommitted 事务先锁定 admin Role 行，取得锁后重读操作者、目标和有效管理员数量；替换关系与包含操作者、目标、前后角色值的 USER_ROLE_UPDATE 审计一起提交，无实际变化时不重复写审计。
- RED：新增单元测试最初因路由模块不存在失败；服务端实现后 19 项通过。浏览器测试随后因用户列表缺少“分配角色”按钮失败，接入弹窗后通过。
- 回滚测试初验发现 MySQL 不支持通过 Prisma 预处理查询创建触发器，改用 `prisma db execute --stdin` 在隔离库创建仅匹配当前测试目标的临时触发器，并在 finally 删除；真实审计写入错误返回 500，角色关系保持原值，未留下审计记录。
- 真实并发验收：两个管理员互相撤权时结果为 200/403；同时各自撤权时结果为 200/409；两种情况最终均保留一个有效管理员。软删除管理员不计数。覆盖已登录目标立即失权、非管理员入口隐藏、非法输入不写入、无变化不重复审计、清空角色、错误恢复及自身撤权后的页面刷新。
- 完整回归：Jest 16 套 / 212 项通过；认证 Playwright / 隔离 MySQL 40 项通过，其中 F06 新增 9 项；TypeScript 和差异格式检查通过。`pnpm lint` 无错误，保留 10 项既有 Hook 依赖警告。`pnpm build` 遇到 Google Fonts 下载超时后自动重试，最终构建通过。
- 隔离库清理复核：本项测试用户和临时审计触发器剩余数量均为零。
- 已查看真实浏览器截图并完成作者自审。实现直接在当前 dev；浏览器测试和构建使用临时副本、3017 端口和隔离数据库，避免影响现有开发服务。未使用子代理，未修改应用数据库，未添加依赖或数据库迁移。

### F07：配置编辑者与审核者权限

**Files:** 新增 `src/app/api/auth/roles/[id]/permissions/route.ts`、`RolePermissionEditor.tsx`；修改 `RoleManager.tsx`、`src/server/features/auth/role.service.ts`、审计动作目录与审计页中文动作名；新增 `tests/role-permissions.test.ts` 和 `tests/integration/role-permissions.spec.ts`；复用现有初始化、角色展示及用户角色分配回归。

**Interfaces:** `replaceRolePermissions(actor: Actor, roleId: string, codes: Permission[]): Promise<void>`；PATCH `/api/auth/roles/:id/permissions` 请求 `{permissions: Permission[]}`，沿用 F05.1 的 `role:update` 边界及 F06 的 `withAdminTransaction`。editor/reviewer 可选现有业务权限，排除四项管理权限；空数组表示撤销该角色全部后台业务权限，重复或未知码返回 400。

- [x] 失败测试：admin/member 权限不可更改；unknown code 拒绝；禁用 editor 的 post:update 后同一会话下一次请求拒绝；再次 setup 不恢复被撤销的权限。
- [x] 运行新增 Jest 测试，确认缺少 PATCH 模块；隔离副本真实 HTTP 返回 405、浏览器缺少编辑入口。实现后运行权限、初始化、授权三组单元测试，48 项通过。
- [x] 实现分组勾选与保存；事务内重新核对 admin 身份、更新授权并写 `ROLE_PERMISSION_UPDATE` 审计。初始化沿用 F05.1 的不覆盖规则；admin 的有效权限始终由完整权限目录决定。保存后刷新角色数据与服务端页面数据。
- [x] 测试通过，浏览器验证刷新后权限仍保存；验证空业务权限会清楚显示不能进入后台，角色页没有删除 admin/member 或编辑其权限的操作。

**F07 执行记录（2026-10-26，基线 82dca4b）：**

- 用户本轮要求“提交，继续下一步”；F06 提交前重新验证 212 项 Jest 和 TypeScript 均通过。当前范围为 F07，完成后按用户要求讲解实现与代码链路，F08 留待下一项。
- Ruling：沿用当前 dev 工作区；本侧聊禁止子代理，由作者独立自审。浏览器与构建使用临时副本及隔离数据库，避免影响现有开发服务。
- Pre-flight：F07 复用 F06 的 withAdminTransaction 和 F05 的权限目录／管理员边界；权限替换仅接受 editor/reviewer 和业务权限，初始化不覆盖授权的规则保持不变。
- 实现：按共享目录展示 17 项业务权限并排除四项管理员权限；新增独立编辑组件管理勾选、错误和保存状态。保存中禁用勾选、取消和角色切换；失败保留勾选；切换角色或取消时丢弃未保存内容；成功重新获取角色并执行 router.refresh。
- 服务端：Zod 校验角色 ID、权限白名单与重复码；admin/member 或不支持的旧角色返回 409，缺失角色 404。复用管理员行锁并在事务内重读操作者身份；角色权限完整替换与 ROLE_PERMISSION_UPDATE 审计原子提交。相同选择不重复写审计，保存会清理历史无效／误授管理权限码。
- 并发语义：授权写入串行执行，后一次提交的完整权限集合生效；审计 before 从事务中的真实数据读取，保持连续变更链。沿用 getActor 每次读取数据库授权，撤权无需退出重登。
- 测试布局调整：新建独立的 role-permissions.spec.ts，避免继续扩充 F06 文件；通过真实 API 撤权后运行 setupAuthorization，验证初始化不会恢复授权，无需改写已有初始化 mock 测试。
- 验证：Jest 17 套 / 236 项通过（F07 新增 24 项）；认证 Playwright / 隔离 MySQL 全量 46 项通过（F07 新增 6 项），覆盖同一会话即时撤权、再次初始化、审计故障真实回滚、并发审计链、界面保存／刷新／清空／重试／切换与提交中禁用。
- TypeScript、差异格式检查及构建通过；lint 无错误，保留 10 项既有 Hook 依赖警告；构建中字体下载自动重试后成功。
- 已查看真实浏览器截图并按权限边界、事务原子性、界面状态与计划范围完成作者自审，无待修复问题；未使用独立审阅者。隔离库中的 F07 临时账号、审计故障触发器剩余均为零，角色授权由测试清理恢复。
- 日志位于 `/var/folders/wq/czh3jxv940nf6d5nqsf7yy100000gn/T/blog-f07-ffspovoa/`。F07 工作区变更待审阅，F08 尚未开始；无数据库结构变更或新增依赖。

### F08：后台新增用户及指定角色

**Files:** 修改 `src/app/api/auth/users/route.ts`、`src/server/features/auth/user.service.ts`、`src/app/(admin)/admin/users/page.tsx`、审计动作目录与审计页中文动作名；按需提取共用账号输入校验供 `registration.service.ts` 复用；新增 `tests/admin-user-create.test.ts`，扩展 `tests/integration/registration.spec.ts`、`tests/integration/forms-compatibility.spec.ts`。

**Interfaces:** `createManagedUser(actor: Actor, input: {name: string; email: string; password: string; roleIds: string[]}): Promise<{id: string; email: string}>`；POST `/api/auth/users` 使用同结构，要求一到四个不重复的内置角色 ID，沿用 `user:create` 管理员边界和 `withAdminTransaction`。两个公开注册入口固定 member，客户端传入的 roleIds 不生效。

- [ ] 失败用例覆盖非 admin 创建拒绝、用户与角色及审计事务原子性、同邮箱并发只有一次成功、空／未知／重复角色拒绝、两个公开注册入口传入管理员角色均无效；拒绝已删除账号使用的同一邮箱复用。
- [ ] 运行 `pnpm test --runInBand tests/admin-user-create.test.ts`，确认现有后台表单仍调用公开注册的缺口。
- [ ] 后台表单改用受保护创建接口，默认选择 member 并允许多选角色；移除后台表单的公开注册验证码依赖。事务内创建账号、关联角色和 `USER_CREATE` 审计。公开注册继续复用已经具备事务的 `registerMember`，保持自动登录；新建邮箱归一化，不批量重写已有邮箱；密码 bcrypt 哈希前校验实际 UTF-8 字节长度不超过 72 字节，前端和服务端提示一致。
- [ ] 单元、真实库并发及浏览器创建用户回归通过；确认后台创建后仍为管理员会话、公开注册自动登录且不再取码；返回值、审计和日志不含明文或密码哈希。

## 阶段验收

用隔离账号验证游客/member/editor/reviewer/admin 页面和 API。运行 `pnpm test --runInBand`、`pnpm exec playwright test --config=playwright.auth.config.ts`、`pnpm exec tsc --noEmit --incremental false`、`pnpm lint`、`pnpm build`；记录完成项、审计与真实并发验证证据。测试和构建沿用阶段一临时副本策略，不与现有开发服务共用 `.next`，不对应用库执行破坏性初始化。每个小功能通过测试并自审后形成独立可提交变更，提交仍按用户当时指令执行。
