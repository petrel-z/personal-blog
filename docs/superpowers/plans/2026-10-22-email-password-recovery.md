# 邮箱验证码找回密码 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 2026-10-26 用户要求“提交代码，继续开发”；F08 已提交为 `e763246`，F09 已提交为 `96ec392`，F10 已完成隔离验收、尚未提交；应用库及真实邮件环境待配置。侧聊禁止子代理，由作者顺序实施与自审；F11–F12 留待后续小功能。

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

**Files:** 新增 `src/server/mail/{config,types,transport,templates}.ts`、`tests/mail.test.ts`、`tests/mail-smtp.test.ts`、`tests/helpers/{capture-mail,capture-smtp}.ts` 及 `tests/fixtures/smtp/` 测试证书；修改 `.env.example`、`package.json` 及实际锁文件。

**Interfaces:** `MailTransport.send(message: {to: string; subject: string; text: string; html: string}): Promise<void>`；`createMailTransport(): MailTransport`；`buildResetCodeMail(code: string): {subject: string; text: string; html: string}`。配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASSWORD`、`MAIL_FROM`；隐式 TLS 与 STARTTLS 严格校验证书。

- [x] 失败测试 `reset_mail_contains_code_and_expiry` 断言文字与 HTML 均展示传入 6 位码和 10 分钟有效说明；`transport_failure_does_not_log_secrets` 断言错误不带认证信息；配置不全拒绝启用。
- [x] 运行 `pnpm test --runInBand tests/mail.test.ts`，确认预期失败；初始化错误泄露回归也先观察失败，再修复。
- [x] 实现配置、SMTP 适配与模板；测试传输只保存在测试进程内，不写真实邮箱、不增加可公开访问的邮件预览 API。
- [x] 测试及 TypeScript 检查通过（项目实际命令为 `pnpm exec tsc --noEmit --incremental false`）；测试传输通过，真实 SMTP 尚待配置，交付此项不阻塞后续业务的本地自动化测试。

**F09 执行记录（2026-10-26，基线 e763246）：**

- F08 以中文提交，提交前 265 项 Jest 与 TypeScript 通过。本轮范围是邮件传输、模板、配置示例和自动化测试，不开放找回页面或发送真实外部邮件。
- Ruling：沿用当前 dev 工作区及计划执行记录，测试／构建使用临时副本；本侧聊不使用子代理。缺少真实邮件配置不阻塞本地验证。
- Pre-flight：MailTransport.send 与模板输出供 F10 注入；配置在创建传输时校验，导入模块不要求邮件凭据，保持现有登录／注册可用。传输层区分整体不可用和收件人拒绝，但错误不携带 SMTP 原始诊断。
- 只读配置检查：.env 与 .env.production 均缺少六项 SMTP／MAIL_FROM 配置。官方文档已核实隐式 TLS、requireTLS 与证书验证；NPM 元数据确认 nodemailer 10.2.1 要求 Node >=20。
- 实现：Zod 校验六项 SMTP 配置、端口／加密模式组合和单一发件地址；工厂创建时校验，模块导入不要求凭据。模板只接收六位 ASCII 数字，保留前导零，生成中文纯文本和 HTML，展示 10 分钟说明；实际过期校验由 F10/F11 实现。
- 传输：465 隐式 TLS，587 强制 STARTTLS，证书验证及 TLS 1.2 下限始终开启；自定义端口同样要求加密。限制单一收件人，发件人仅由服务端配置提供，丢弃额外字段；关闭协议调试和文件／URL 内容读取，设置连接、问候、DNS 及空闲超时。服务端确认接受收件人才算传输成功，不承诺最终进入收件箱。
- 错误：配置、内容、整体服务不可用、收件人拒绝使用稳定错误码和中文提示；SMTP 初始化与发送异常均不保留原始消息、response 或 cause，避免凭据、收件地址和验证码进入上层错误。
- 测试：新增 42 项邮件测试，其中 5 项使用真实本机 SMTP 连接，验证隐式 TLS／STARTTLS 成功、服务器不支持 STARTTLS 时拒绝、两种模式下不可信证书均在认证前拒绝。其余覆盖配置、模板、消息边界、错误脱敏及 SMTP 接受结果。测试邮件仅保存在进程内，测试证书仅由测试子进程信任，无外部投递。
- 测试布局调整：将原定 F12 的 capture-smtp 辅助工具提前到 F09，以实际连接验证加密策略；F12 可扩展复用。测试夹具的 Set 遍历改用 forEach，兼容项目既有 TypeScript 编译目标。
- 依赖决策：固定 nodemailer 10.2.1，使用其内置类型；当前 Node 20.19.6 满足要求。现有 next-auth/@auth/core 的可选邮件依赖范围仍要求 6.x／7.x，安装会报告 peer 范围不匹配；不修改其声明或升级认证栈来掩盖提示。当前认证未使用 Auth.js 邮件 provider，现有认证回归全部通过；未来启用该 provider 前需重新核实兼容性。
- 验证：全量 Jest 20 套 / 307 项、认证 Playwright / 隔离 MySQL 57 项均通过；TypeScript、差异格式检查和生产构建通过。lint 无错误，保留 10 项既有 Hook 依赖警告；构建提示既有 Browserslist 数据过期。已查看 Chromium 邮件模板截图并完成配置边界、传输加密、异常脱敏及计划范围自审，无独立审阅者。
- 最终交付核对发现副本测试证书与工作区版本不同，已同步最终证书并重跑 5 项真实 SMTP 测试，全部通过；交付的源码、依赖和测试夹具与最终验证副本一致。
- 证据日志及模板预览：`/var/folders/wq/czh3jxv940nf6d5nqsf7yy100000gn/T/blog-f09-wr6v9zjj/`。测试与构建使用临时副本及隔离数据库，未修改实际 SMTP 配置；F09 保留工作区待审阅，F10–F12 尚未实施。配置语义参考 [Nodemailer SMTP 文档](https://nodemailer.com/smtp)。

### F10：申请并发送密码找回验证码

**Files:** 新增 `src/server/features/auth/password-reset{.service,-code,-error}.ts`、`src/app/api/auth/password-reset/request/route.ts`、`tests/password-reset-request.test.ts`、`tests/integration/password-reset-issue.spec.ts` 和增量建表脚本 `prisma/patches/20261026_password_reset.sql`；修改 `prisma/schema.prisma`、`.env.example`、邮件传输接口与对应测试、`playwright.auth.config.ts`。

**Interfaces:** `requestPasswordReset(input: {email: string; captchaId: string; captchaCode: string; ip: string}, deps?: {mail?: MailTransport}): Promise<{message: string; retryAfterSeconds: number}>`；POST `/api/auth/password-reset/request` 不接受客户端 ip，以服务端请求上下文解析。固定成功提示“如果该邮箱已注册，你将收到验证码”。验证码记录保存 emailKey、userId、challengeId、codeHash、expiresAt、failedAttempts、sentAt、consumedAt、deliveryStatus；每 emailKey 只有一个活动记录。验证码签名使用新增专用 `AUTH_CODE_SECRET`，不与邮件凭据混用。

- [x] 失败测试：验证码严格为 6 位数字（允许前导零）；10 分钟过期；60 秒内重发拒绝；发送额度耗尽 429；未知／已删除邮箱响应一致；没有图片验证码不查询用户或发送邮件。
- [x] 运行 `pnpm test --runInBand tests/password-reset-request.test.ts`，确认预期失败。
- [x] 复用 F03 `consumeCaptcha` 的 password-reset 用途、F04 `emailKey` 与 `consumeQuota`。申请先对存在／不存在邮箱一致地预留额度及重发时间，MySQL 行锁保护单活动挑战；SMTP 调用不占长事务。验证码发送结果只更新匹配 challengeId 的记录，失败记录不可用于重置。整体邮件服务不可用统一报系统错误；按收件人发生的投递失败只记脱敏运维结果，不能通过申请响应暴露账号。
- [x] 单元与实际库并发测试通过，验证重新发送后上一验证码不可用；API 不返回验证码，测试邮件只通过注入的捕获传输取得。

**F10 执行记录（2026-10-26，基线 96ec392）：**

- 用户要求“提交并继续”；F09 提交前重新通过 307 项 Jest、TypeScript 和差异检查，中文提交“feat(auth): 增加安全邮件传输与密码重置验证码模板”（96ec392）。提交核对补齐被 *.pem 忽略的两份公开测试夹具，并仅为这两条路径增加例外。
- Ruling：沿用当前 dev 工作区，隔离副本运行浏览器和构建，计划执行记录继续作为账本；本侧聊不使用子代理，完成 F10 后逐项交付，F11/F12 留待后续。
- Pre-flight：复用 F03 的 password-reset 图片验证码和 F04 的 emailKey/consumeQuota；F09 的纯发送接口需补充 verify()，在查询账号前统一检查连接与认证。捕获传输实现无网络检查，真实适配器使用 SMTP verify，不发送测试邮件。
- Ruling：配置或统一可用性检查失败对全部邮箱返回 503；预检查通过后出现的单次投递失败均记录脱敏结果、清除该挑战摘要并维持统一申请响应。这避免连接在预检查后中断时泄露账号存在性；代价是这种故障不会在申请页面直接报发送失败，用户可冷却后重试。
- Pre-flight：新增按 emailKey 唯一的挑战，绑定 userId/challengeId/HMAC 摘要及投递状态；F11 仅能消费 SENT、未过期、未消费且属于当前用户的记录。SMTP 调用在事务外，完成结果按 challengeId 条件更新，旧发送不能覆盖新挑战。
- Ruling：数据库采用独立增量建表 SQL，先在隔离测试库验证；本轮不改应用库。AUTH_CODE_SECRET 只在示例中列出，不生成或修改实际环境密钥。

- 实现链路：请求路由只从服务端请求上下文读取 IP，覆盖 body.ip；格式和图片验证码先校验，随后读取专用密钥，并按 IP／邮箱分别消耗每小时 20／5 次申请额度。冷却期间的有效申请也占额度；额度失败返回 429、Retry-After 和 retryAfterSeconds，图片验证码已消费需刷新。
- 并发与凭据：crypto.randomInt 生成六位数字，允许前导零；AUTH_CODE_SECRET 至少 32 字节且不可复用 AUTH_SECRET/NEXTAUTH_SECRET。HMAC 绑定 password-reset 用途、邮箱键、challengeId 和验证码。INSERT ON DUPLICATE KEY UPDATE 与 FOR UPDATE 保护同一邮箱，包括未知邮箱；短事务内校验 60 秒冷却并替换活动挑战，写入 10 分钟过期时间。记录绑定原账号 userId，防止未来邮箱被其他账号占用后复用挑战。
- 发送与失败：配置／连接检查在查询用户前执行；投递在事务外完成。只给未删除账号发送，未知／已删除账号记录同样冷却但不保留可用摘要。成功记录 SENT；失败清除摘要并记 FAILED，固定日志不包含邮件内容或原始 SMTP 错误。完成写入同时匹配邮箱键、challengeId 和 PENDING，已过时的发送结果不能修改新挑战。
- API：POST /api/auth/password-reset/request；成功只返回统一提示和 60 秒重试信息，禁止缓存，不返回账号、验证码或挑战 ID。缺少 SMTP 或专用签名密钥时不开放实际找回；预检查后的投递故障按上述 Ruling 保持相同响应。来源 IP 沿用项目 getClientIp，部署时需要可信反向代理覆盖 X-Forwarded-For；不接受 JSON 中的客户端 IP。
- RED/GREEN：先观察恢复模块缺失和 verify 缺失失败，随后完成实现。新增 12 项 Jest（含 F09 verify 扩展及 IPv6 回归）和 15 项实际数据库／路由集成测试；覆盖四请求并发只发一封、每邮箱五次上限、IP 最后一份额度并发争用、重发替换旧摘要、投递失败清除摘要、旧发送晚成功／晚失败、未知与删除邮箱、错误用途与重复图片验证码、HTTP 400/429/503，以及真实 TLS 连接的路由成功发送且响应不含身份或验证码。
- 作者自审：按 code-reviewer 模板检查计划对齐、事务、错误、输入与测试范围；未使用独立审阅者。发现 Node isIP 接受带网卡标识的 IPv6，但 URL 解析会抛错；补充回归先复现 ERR_INVALID_URL，再将这类无效来源归入 unknown 限流键。最后将 HTTP 配置失败测试改为独立来源 IP，避免反复运行累积公共测试 IP 的额度。
- 验证：最终全量 Jest 21 套／319 项通过，完整认证 Playwright／隔离 MySQL 72 项通过，TypeScript、lint 和生产构建通过（lint 保留 10 项既有 Hook 警告）。增量 SQL 经 schema diff 核对只新增一张挑战表；隔离库应用后 schema diff 为空。测试账号、挑战及 reset:send 限流记录已清理。
- 最终 IPv6 修复与测试 IP 隔离后，重新运行三项路由边界／真实 TLS 投递测试，全部通过；最终实现文件与验证副本逐一比对一致。
- 验收边界：仅在隔离测试库应用增量 SQL，应用库只做只读 schema diff；启用时需应用建表脚本并配置 AUTH_CODE_SECRET 与 SMTP。真实服务商收信尚未验证；验证码消费、新密码更新、旧会话撤销和页面入口仍属 F11/F12。统一状态／文案与额度不等于恒定响应时延；严格抹平 SMTP 投递的时序差异需另行设计异步投递流程。
- 证据目录：`/var/folders/wq/czh3jxv940nf6d5nqsf7yy100000gn/T/blog-f10-tetgmovd/`。F10 工作区变更待审阅，无新的业务依赖。

### F11：验证邮件验证码、更新密码和撤销旧会话

**Files:** 新增 `src/app/api/auth/password-reset/confirm/route.ts`、`src/server/features/auth/session-version.service.ts`、`tests/password-reset-confirm.test.ts`、`tests/session-version.test.ts`、`tests/integration/password-reset-consume.spec.ts`；修改恢复服务、`prisma/schema.prisma`、`auth.ts`、`src/server/auth/access.ts`、`src/shared/types/index.ts`、F04 登录测试。

**Interfaces:** `confirmPasswordReset(input: {email: string; code: string; newPassword: string; ip: string}): Promise<void>`；POST `/api/auth/password-reset/confirm`；`isSessionCurrent(userId: string, sessionVersion: number): Promise<boolean>`。User 增加 `sessionVersion Int @default(0)`，认证成功读取的版本随 user 固定写入 JWT；session 和 getActor 校验最新版本，缺失／失配都拒绝。

- [ ] 失败测试覆盖正确码重置、过期／旧码／重复码拒绝、5 次错误后失效、重发不重置整体校验额度、并发只有一次成功；新密码 UTF-8 超过 bcrypt 72 字节拒绝。
- [ ] 运行 `pnpm test --runInBand tests/password-reset-confirm.test.ts tests/session-version.test.ts`，确认预期失败。
- [ ] 事务锁定活动挑战和用户，完成验证码常量时间比较、密码哈希更新、挑战消费及 sessionVersion 加一；错误计数更新以业务结果返回后再转换错误，确保提交计数。密码校验时读出的版本与密码快照绑定，JWT 回调不得用后来读到的版本给旧密码登录升级会话。
- [ ] 单元与真实库并发测试通过；验证旧 JWT 访问会话接口和管理 API 都无效，新密码可登录，旧密码失败。重置事务失败不消费验证码、不改密码／版本。

### F12：忘记密码页面与完整找回体验

**Files:** 新增 `src/app/forgot-password/page.tsx`、`src/app/forgot-password/_components/PasswordResetForm.tsx`、`tests/e2e/password-recovery.spec.ts`；复用／扩展 F09 的 `tests/helpers/capture-smtp.ts`；修改 `src/app/login/page.tsx`、`src/shared/validations/index.ts`、`playwright.auth.config.ts`、`tests/integration/auth-fixtures.ts`，更新本计划的环境说明。

**Interfaces:** 复用 F02 `useCaptcha('password-reset')` 与 F10/F11 路由。第一步邮箱＋图片验证码，第二步邮件验证码＋新密码＋确认密码；重发申请使用新图片验证码。倒计时读取服务端 retryAfterSeconds；浏览器可保存不含邮箱/验证码/密码的冷却截止时间以恢复展示，服务端始终最终判定。

- [ ] 浏览器失败回归：完整找回、输入错误码、过期码、确认密码不一致、重发倒计时、刷新后重发仍受限、网络失败可重试；成功返回登录页后使用新密码登录。
- [ ] 运行 `pnpm exec playwright test --config=playwright.auth.config.ts tests/e2e/password-recovery.spec.ts`，确认当前没有入口和流程。测试启动本地 SMTP 捕获器，再把其连接配置传给专用应用进程；测试从捕获器读取邮件，页面和业务 API 不提供读取验证码的后门。
- [ ] 实现两步表单、“重新发送”“返回登录”和成功反馈；邮箱只在当前组件内保留，验证码／密码仅内存保存；失败按 F02 刷新已消费的图片验证码，按钮状态防重复提交。
- [ ] 浏览器流程及 `pnpm typecheck` 通过，复核日志与存储不含敏感输入。真实 SMTP 未配置时标记验收限制，不将仅接口成功当作真实收信成功。

## 阶段验收

端到端写入使用隔离测试库和专用测试服务，不复用用户 3000 端口现有进程；测试 SMTP 捕获器和页面只能在测试环境使用。运行相关 Jest、Playwright 后，再运行 `pnpm test --runInBand`、`pnpm typecheck`、`pnpm lint`、`pnpm build`。记录邮件测试传输／实际投递、旧会话失效、并发消费三类证据及未完成配置。
