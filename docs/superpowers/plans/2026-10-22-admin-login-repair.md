# 本地管理员与登录修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. 用户已在侧聊明确授权实施阶段一；F01–F04 已完成。执行差异与验证证据见 [执行记录](./2026-10-22-phase1-execution.md)。

**Goal:** 恢复指定本地管理员访问，修复图片验证码重试，补齐服务端验证码校验和登录失败限制。

**Architecture:** 复用现有授权模型和初始化脚本。验证码改为独立表单状态，服务端以 MySQL 保存短期挑战和登录失败记录；权限仍逐请求读取数据库。

**Tech Stack:** Next.js 14、Auth.js、Prisma/MySQL、TypeScript、Jest、Playwright。

**Spec:** [总体设计](../specs/2026-10-22-admin-auth-recovery-design.md)；[开发路线](./2026-10-22-admin-auth-roadmap.md)。

## Global Constraints

- 只恢复明确指定的本地管理员；不猜密码、不截断异常哈希、不自动提升注册用户。
- 图片验证码沿用 4 位、5 分钟有效，限定用途且一次消费；登录失败 5 次锁定 15 分钟。
- 登录、注册和评论保持兼容；错误提示区分验证码、凭据、锁定和服务异常，不对外暴露账号是否存在。
- 数据库变更只使用增量方案，不 reset 数据库、不使用 `--accept-data-loss`。本仓库没有迁移基线：先记录只读 schema diff，测试库验证后再执行明确授权的本地增量变更。
- 每项独立验证、审阅；凭据和验证码不写日志。F01 为运维恢复，复用现有测试，不为只读诊断增加实现镜像测试。

## Review Focus

- F02：快速连点刷新、旧请求晚返回、加载失败不能留下旧验证码 ID。
- F03：同一码并发提交只有一次可消费；跨登录／注册／评论用途不能复用。
- F04：并发错误密码不会绕过 5 次阈值；不存在的邮箱使用同样的限流键策略。
- F04：外站 callbackUrl、javascript URL 和无权限后台地址不能成为登录跳转目标。
- F01/F04：没有有效管理角色时必须明确区分身份认证成功与后台授权失败。

## File Structure

- 沿用 `scripts/setup-auth.ts`、`src/server/auth/{access,route}.ts`；新增 `src/shared/roles.ts` 管理内置角色目录。
- 验证码实现放在 `src/server/features/auth/captcha.service.ts`；表单逻辑放在 `src/client/hooks/useCaptcha.ts`，保留现有 CaptchaInput 外观。
- 登录失败及通用额度逻辑分别放在 `src/server/features/auth/login-attempt.service.ts`、`rate-limit.service.ts`。
- 登录去向共用 `src/shared/permissions.ts` 中的纯函数；认证出口沿用根目录 `auth.ts`。

### F01：恢复本地管理员权限

**Files:** 复用 `scripts/setup-auth.ts`、`tests/setup-auth.test.ts`、`tests/authorization.test.ts`；恢复结果记录到本计划。

**Interfaces:** 已有 `setupAuthorization(db: PrismaClient, adminEmail: string): Promise<string>`；命令 `pnpm auth:setup --admin-email '<明确指定的现有邮箱>'`。

- [x] 核对目标邮箱及当前角色、密码哈希格式；用户已明确指定 `1207574452@qq.com`，并授权以私密文件保存随机新密码。
- [x] 运行 `pnpm test --runInBand tests/setup-auth.test.ts tests/authorization.test.ts`；预期全部通过，缺失／已删除账号不得写入授权。
- [x] 在目标确定且获恢复授权后执行既有初始化脚本；只读核对四个角色、权限目录、目标用户 admin 关联与其他用户角色。
- [x] 用用户可用凭据验证登录；若凭据未知或哈希异常，记录“授权已恢复，密码登录未验证”，继续独立任务；不将数据库角色存在当作完整登录成功。

### F02：图片验证码刷新与失败重试

**Files:** 新增 `src/client/hooks/useCaptcha.ts`；修改 `src/app/(admin)/_components/{CaptchaInput,LoginForm}.tsx`、`src/app/register/page.tsx`、`src/app/(admin)/admin/users/page.tsx`；新增 `tests/e2e/auth-captcha.spec.ts`。

**Interfaces:** `useCaptcha(purpose: CaptchaPurpose): { id: string | null; imageUrl: string | null; value: string; setValue(value: string): void; loading: boolean; error: string | null; refresh(): Promise<void> }`。`CaptchaPurpose = 'login' | 'register' | 'comment' | 'password-reset'` 放入 `src/shared/types/auth.ts`；F02 发送 purpose 查询参数，F03 开始强制校验。

- [x] 写浏览器失败回归：`password_failure_refreshes_captcha` 断言图片 ID 改变、验证码清空、邮箱密码保留；`latest_refresh_wins` 断言后发请求的图片和 ID 成套显示；`failed_refresh_disables_submit` 断言不可使用旧 ID 提交。
- [x] 通过 `--config=playwright.auth.config.ts` 运行认证浏览器回归；先确认原行为失败，再确认修复通过。
- [x] 实现 hook 和组件显式传值，去除三个认证表单的 window 全局 ID；失败、过期及手动刷新统一走 refresh，取消过时请求并释放对象 URL。此项仍保留现有独立验证码 POST，F03 再整体切换。
- [x] 同一命令通过，覆盖登录与两个注册入口；运行 `pnpm typecheck`，独立审阅 F02 变更。

### F03：服务端验证码校验

**Files:** 新增 `src/server/features/auth/captcha.service.ts`、`src/shared/types/auth.ts`（若 F02 已创建则修改）；修改 `prisma/schema.prisma`、`src/app/api/captcha/route.ts`、`auth.ts`、`src/app/api/auth/register/route.ts`、`src/app/api/comments/route.ts`、F02 三个表单、`src/app/(public)/_components/CommentSection.tsx`；新增 `tests/captcha.test.ts`、`tests/auth-captcha.test.ts`、`tests/integration/captcha.spec.ts`，更新 `tests/login-authorization.test.ts`。

**Interfaces:** `issueCaptcha(purpose: CaptchaPurpose): Promise<{id: string; svg: string}>`；`consumeCaptcha(input: {id: string; code: string; purpose: CaptchaPurpose}): Promise<boolean>`。凭据、注册和评论请求共同使用字段 `captchaId`、`captchaCode`。MySQL `CaptchaChallenge` 保存 id、purpose、codeHash、expiresAt；以服务端密钥摘要保护验证码。

- [x] 失败用例：`missing_captcha_never_checks_password`、`wrong_purpose_is_rejected`、`expired_code_is_rejected`；实际测试库的 `concurrent_consume_has_one_winner` 断言两个并发结果恰有一个 true。
- [x] 通过真实 HTTP／隔离 MySQL 的 `tests/integration/captcha.spec.ts` 验证服务端缺口及修复，并保留 `tests/login-authorization.test.ts` 的授权和短路断言；不重复实现两组 mock 验证码测试。
- [x] 实现共享服务和原子消费；生成字符仅用字母数字，输入大小写不敏感。认证／注册直接接收并消费验证码，移除前端先验证的双请求。评论使用同一服务并传 comment 用途；旧独立 POST 保留仅 comment 兼容行为，不能产出登录或注册的通行凭据。
- [x] 同组测试通过；运行 F02 浏览器回归及隔离 MySQL 并发测试，确认注册和评论均可正常提交，提交代码前审阅新增 schema diff。

### F04：登录失败限制与成功跳转

**Files:** 新增 `src/server/features/auth/{login-attempt,rate-limit}.service.ts`、`src/server/features/auth/identity.ts`、`src/app/api/auth/access/route.ts`；修改 `prisma/schema.prisma`、`auth.ts`、`src/shared/permissions.ts`、`src/app/(admin)/_components/LoginForm.tsx`、`src/app/forbidden/page.tsx`；新增 `tests/login-attempt.test.ts`、`tests/auth-rate-limit.test.ts`、`tests/login-redirect.test.ts`、`tests/integration/login-attempt.spec.ts`。

**Interfaces:** `runLoginAttempt<T>(emailKey: string, verify: () => Promise<T | null>): Promise<{kind: 'success'; user: T} | {kind: 'invalid'} | {kind: 'locked'; retryAfterSeconds: number}>` 统一持有邮箱锁并执行验证、计数或清零；`consumeQuota(key: string, limit: number, windowSeconds: number): Promise<{allowed: boolean; retryAfterSeconds: number}>`；`normalizeEmail(value: string): string` 去首尾空白并转小写，`emailKey(value: string): string` 用 AUTH_SECRET 与用途前缀做 HMAC 派生。`getPostLoginPath(permissions: readonly Permission[], callbackUrl?: string): string` 仅返回有权访问的站内后台页面或 `/forbidden`。GET `/api/auth/access` 返回当前 actor 的 permissions、首选去向，不缓存。

- [x] 失败用例断言前四次错误可重试，第五次后返回锁定；15 分钟到期恢复，成功清零；未知邮箱同样累计。跳转测试拒绝外站／协议 URL／无权限页面，允许有权限 callbackUrl。
- [x] 运行 `pnpm test --runInBand tests/login-attempt.test.ts tests/auth-rate-limit.test.ts tests/login-redirect.test.ts`，确认现有缺口。
- [x] MySQL `LoginAttempt` 按邮箱键存 failures／lockedUntil，`AuthRateBucket` 按 key 存 count／windowStart。使用事务和行锁串行化同邮箱的并发密码尝试，检查、密码结果和失败次数更新必须处于同一临界区。把安全错误码映射到客户端；成功后请求 access 获取有效去向，错误时按 F02 刷新验证码。
- [x] 单元测试、真实 MySQL 并发回归和登录浏览器回归通过；验证无权限账号进入明确的无权限页面，`pnpm typecheck` 通过，单独审阅 F04。

## 阶段验收与测试环境

集成测试配置新增 `playwright.auth.config.ts`、`tests/integration/auth-fixtures.ts`：testDir 为 `tests`，testMatch 限定 `integration/**/*.spec.ts` 和认证相关 `e2e/{auth-captcha,admin-roles,password-recovery}.spec.ts`（以配置数组明确列出，不匹配原有搜索测试）。仅接受显式 `AUTH_TEST_DATABASE_URL`，URL 必须不同于应用 DATABASE_URL，库名必须以 `_auth_test` 结尾；不复用 3000 端口现有应用。用 `pnpm exec playwright test --config=playwright.auth.config.ts` 执行，测试只清理自己创建的数据。F03 首次需要时连同任务一起建立，F04 及后续任务复用；F02 在此之前仅使用浏览器请求拦截验证表单，不写真实账号。

四项完成后运行 `pnpm test --runInBand`、`pnpm typecheck`、`pnpm lint`、`pnpm build`；记录实际结果与既有警告。编译使用独立输出目录或停止本任务启动的测试进程，避免污染用户运行中的开发服务。
