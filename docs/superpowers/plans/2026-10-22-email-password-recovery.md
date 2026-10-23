# 邮箱验证码找回密码 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本次请求仅为拆分；不要因本文件存在而自动开始实施。

**Goal:** 用户通过注册邮箱接收 6 位验证码，设置新密码并撤销旧会话。

**Architecture:** SMTP 传输与验证码、密码恢复业务分离，以可注入测试传输验证本地完整流程。短期凭据存 MySQL 摘要，消费与密码／会话版本更新在同一事务内完成。

**Tech Stack:** Next.js 14、Auth.js JWT、Prisma/MySQL、Node crypto、bcryptjs、SMTP 传输、Jest、Playwright。实施 F09 时选定并核实兼容 Node 20 的维护中 SMTP 库版本，不升级无关依赖。

**Spec:** [总体设计](../specs/2026-10-22-admin-auth-recovery-design.md)；[开发路线](./2026-10-22-admin-auth-roadmap.md)；依赖 F03、F04 的验证码与限流接口。

## Global Constraints

- 6 位数字邮件验证码，10 分钟有效，重发间隔 60 秒，重发旧码失效，每码最多 5 次错误校验。
- 发送额度默认每邮箱 5 次/小时、每 IP 20 次/小时；校验额度每邮箱 20 次/15 分钟、每 IP 100 次/15 分钟。重发不会清空这些额度。
- 未知／已删除邮箱与正常邮箱使用相同申请响应和额度规则；密码找回不能更改收信邮箱。
- 数据库只保存 HMAC 摘要；密码、验证码和 SMTP 凭据不进日志、API 响应或浏览器持久存储。
- 捕获邮件测试传输仅供自动化测试；真实收信必须使用实际配置明确验证，不能伪报发送成功。外部真实发信只向用户明确授权的测试收件人发送。
- 邮件恢复入口在 F12 才对页面开放；F09–F11 分别通过隔离服务测试验收。

## Review Focus

- F10：两个发送请求并发不能绕过 60 秒间隔，旧请求不能覆盖新验证码。
- F10：未知邮箱、SMTP 拒绝、配置缺失的响应不能泄露账号存在性；失败发送不会留下可用但未投递的新验证码。
- F11：两个正确重置请求并发只有一个成功；错误尝试必须落库，不能因业务抛错回滚计数。
- F11：密码重置与旧密码登录同时发生，旧凭据不能获得新的有效会话版本。
- F12：页面刷新不绕过倒计时，重复点提交不多次发信，不保存验证码和密码。

## File Structure

- `src/server/mail/{config,types,transport,templates}.ts` 分别负责环境校验、传输接口、SMTP 实现和邮件内容。
- `src/server/features/auth/password-reset.service.ts` 负责申请和消费；复用 F04 `identity.ts`、`rate-limit.service.ts`。
- `src/app/api/auth/password-reset/{request,confirm}/route.ts` 提供 API；`src/app/forgot-password/page.tsx` 提供单页两步交互。
- Prisma 增加 `PasswordResetChallenge` 和 `User.sessionVersion`，增量变更流程沿用登录计划；旧 JWT 没有版本时需重新登录。

### F09：邮件传输与验证码邮件模板

**Files:** 新增 `src/server/mail/{config,types,transport,templates}.ts`、`tests/mail.test.ts`、`tests/helpers/capture-mail.ts`；修改 `.env.example`、`package.json` 及实际锁文件。

**Interfaces:** `MailTransport.send(message: {to: string; subject: string; text: string; html: string}): Promise<void>`；`createMailTransport(): MailTransport`；`buildResetCodeMail(code: string): {subject: string; text: string; html: string}`。配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASSWORD`、`MAIL_FROM`；隐式 TLS 与 STARTTLS 严格校验证书。

- [ ] 失败测试 `reset_mail_contains_code_and_expiry` 断言文字与 HTML 均展示传入 6 位码和 10 分钟有效说明；`transport_failure_does_not_log_secrets` 断言错误不带认证信息；配置不全拒绝启用。
- [ ] 运行 `pnpm test --runInBand tests/mail.test.ts`，确认预期失败。
- [ ] 实现配置、SMTP 适配与模板；测试传输只保存在测试进程内，不写真实邮箱、不增加可公开访问的邮件预览 API。
- [ ] 测试及 `pnpm typecheck` 通过，记录“测试传输通过／真实 SMTP 尚待配置”或实际获授权投递证据；交付此项不阻塞后续业务的本地自动化测试。

### F10：申请并发送密码找回验证码

**Files:** 新增 `src/server/features/auth/password-reset.service.ts`、`src/app/api/auth/password-reset/request/route.ts`、`tests/password-reset-request.test.ts`、`tests/integration/password-reset-issue.spec.ts`；修改 `prisma/schema.prisma`、`.env.example`。

**Interfaces:** `requestPasswordReset(input: {email: string; captchaId: string; captchaCode: string; ip: string}, deps: {mail: MailTransport}): Promise<{message: string; retryAfterSeconds: number}>`；POST `/api/auth/password-reset/request` 不接受客户端 ip，以服务端请求上下文解析。固定成功提示“如果该邮箱已注册，你将收到验证码”。验证码记录保存 emailKey、challengeId、codeHash、expiresAt、failedAttempts、sentAt、consumedAt、deliveryStatus；每 emailKey 只有一个活动记录。验证码签名使用新增专用 `AUTH_CODE_SECRET`，不与邮件凭据混用。

- [ ] 失败测试：验证码严格为 6 位数字（允许前导零）；10 分钟过期；60 秒内重发拒绝；发送额度耗尽 429；未知／已删除邮箱响应一致；没有图片验证码不查询用户或发送邮件。
- [ ] 运行 `pnpm test --runInBand tests/password-reset-request.test.ts`，确认预期失败。
- [ ] 复用 F03 `consumeCaptcha` 的 password-reset 用途、F04 `emailKey` 与 `consumeQuota`。申请先对存在／不存在邮箱一致地预留额度及重发时间，MySQL 行锁保护单活动挑战；SMTP 调用不占长事务。验证码发送结果只更新匹配 challengeId 的记录，失败记录不可用于重置。整体邮件服务不可用统一报系统错误；按收件人发生的投递失败只记脱敏运维结果，不能通过申请响应暴露账号。
- [ ] 单元与实际库并发测试通过，验证重新发送后上一验证码不可用；API 不返回验证码，测试邮件只通过注入的捕获传输取得。

### F11：验证邮件验证码、更新密码和撤销旧会话

**Files:** 新增 `src/app/api/auth/password-reset/confirm/route.ts`、`src/server/features/auth/session-version.service.ts`、`tests/password-reset-confirm.test.ts`、`tests/session-version.test.ts`、`tests/integration/password-reset-consume.spec.ts`；修改恢复服务、`prisma/schema.prisma`、`auth.ts`、`src/server/auth/access.ts`、`src/shared/types/index.ts`、F04 登录测试。

**Interfaces:** `confirmPasswordReset(input: {email: string; code: string; newPassword: string; ip: string}): Promise<void>`；POST `/api/auth/password-reset/confirm`；`isSessionCurrent(userId: string, sessionVersion: number): Promise<boolean>`。User 增加 `sessionVersion Int @default(0)`，认证成功读取的版本随 user 固定写入 JWT；session 和 getActor 校验最新版本，缺失／失配都拒绝。

- [ ] 失败测试覆盖正确码重置、过期／旧码／重复码拒绝、5 次错误后失效、重发不重置整体校验额度、并发只有一次成功；新密码 UTF-8 超过 bcrypt 72 字节拒绝。
- [ ] 运行 `pnpm test --runInBand tests/password-reset-confirm.test.ts tests/session-version.test.ts`，确认预期失败。
- [ ] 事务锁定活动挑战和用户，完成验证码常量时间比较、密码哈希更新、挑战消费及 sessionVersion 加一；错误计数更新以业务结果返回后再转换错误，确保提交计数。密码校验时读出的版本与密码快照绑定，JWT 回调不得用后来读到的版本给旧密码登录升级会话。
- [ ] 单元与真实库并发测试通过；验证旧 JWT 访问会话接口和管理 API 都无效，新密码可登录，旧密码失败。重置事务失败不消费验证码、不改密码／版本。

### F12：忘记密码页面与完整找回体验

**Files:** 新增 `src/app/forgot-password/page.tsx`、`src/app/forgot-password/_components/PasswordResetForm.tsx`、`tests/e2e/password-recovery.spec.ts`、`tests/helpers/capture-smtp.ts`；修改 `src/app/login/page.tsx`、`src/shared/validations/index.ts`、`playwright.auth.config.ts`、`tests/integration/auth-fixtures.ts`，更新本计划的环境说明。

**Interfaces:** 复用 F02 `useCaptcha('password-reset')` 与 F10/F11 路由。第一步邮箱＋图片验证码，第二步邮件验证码＋新密码＋确认密码；重发申请使用新图片验证码。倒计时读取服务端 retryAfterSeconds；浏览器可保存不含邮箱/验证码/密码的冷却截止时间以恢复展示，服务端始终最终判定。

- [ ] 浏览器失败回归：完整找回、输入错误码、过期码、确认密码不一致、重发倒计时、刷新后重发仍受限、网络失败可重试；成功返回登录页后使用新密码登录。
- [ ] 运行 `pnpm exec playwright test --config=playwright.auth.config.ts tests/e2e/password-recovery.spec.ts`，确认当前没有入口和流程。测试启动本地 SMTP 捕获器，再把其连接配置传给专用应用进程；测试从捕获器读取邮件，页面和业务 API 不提供读取验证码的后门。
- [ ] 实现两步表单、“重新发送”“返回登录”和成功反馈；邮箱只在当前组件内保留，验证码／密码仅内存保存；失败按 F02 刷新已消费的图片验证码，按钮状态防重复提交。
- [ ] 浏览器流程及 `pnpm typecheck` 通过，复核日志与存储不含敏感输入。真实 SMTP 未配置时标记验收限制，不将仅接口成功当作真实收信成功。

## 阶段验收

端到端写入使用隔离测试库和专用测试服务，不复用用户 3000 端口现有进程；测试 SMTP 捕获器和页面只能在测试环境使用。运行相关 Jest、Playwright 后，再运行 `pnpm test --runInBand`、`pnpm typecheck`、`pnpm lint`、`pnpm build`。记录邮件测试传输／实际投递、旧会话失效、并发消费三类证据及未完成配置。
