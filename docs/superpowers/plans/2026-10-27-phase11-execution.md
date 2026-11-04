# F11 执行记录

- 当前请求：用户在侧聊明确要求“提交，并继续开发”；本轮提交已有 F10，并完成下一个小功能 F11。
- F10：提交 `327e86b`（feat(auth): 支持申请密码找回验证码与发送限流）；提交前 319 项 Jest、TypeScript 和差异检查通过。
- F11 工作目录：`/Users/petrel/.codex/worktrees/password-reset-confirm/blog`，分支 `codex/password-reset-confirm`，基线 `327e86b`。
- Ruling：F11 改动现有 User 结构与认证行为，使用隔离工作目录和专用测试库，避免使主工作区正在运行的应用因缺少字段而登录失败；应用库不在开发验收过程中迁移。
- 原生 worktree 已创建，但侧聊 ID 注册失败，attach 重试同样失败；继续显式使用返回的同一工作目录，不创建重复 checkout。
- Pre-flight：F10 的挑战绑定邮箱键、用户 ID、挑战 ID 和投递状态；F11 只接受 SENT、未过期、未消费且仍绑定当前有效用户的挑战。
- Pre-flight：Auth.js JWT 回调在 session 请求及服务端 auth() 上都会执行；返回 null 清理会话。认证时从密码快照携带 sessionVersion，不能在签发时把旧凭据升级到新的版本。
- Ruling：继续逐项交付，F12 页面保留下一项；本侧聊禁用子代理，按代码审阅清单独立自审。
- Ruling：复用本执行记录作为进度账本；数据库并发行为使用真实隔离 MySQL 测试，单元测试覆盖认证回调、输入与错误边界。

## 实现与验证

- RED：新增 21 项输入／会话回调测试先全部失败；真实 HTTP 首项测试在尚无 confirm 路由时返回 400，预期 200，证据分别为 `/tmp/blog-f11-red.log` 与 `/tmp/blog-f11-http-red.log`。
- GREEN：实现后 21 项新增测试通过；再补充 6 项权限边界测试，拒绝缺失／非法版本以及会话校验后、权限查询前发生重置的旧会话。已有权限测试补齐真实登录会话必有的版本 0，不放宽生产检查。
- Ruling：F10 申请接口继续由原服务提供，消费逻辑独立为 password-reset-confirm.service.ts，公共 IP 校验提取到 password-reset-input.ts；外部导出接口保持与计划一致。
- Ruling：成功恢复时在同一事务清除该邮箱的 LoginAttempt 锁定，避免新密码仍被旧失败记录阻止；登录中的旧密码认证仅携带旧版本，签发／访问阶段均不得升级。
- 完整 Jest：23 套／346 项通过（`pnpm test --runInBand`，`/tmp/blog-f11-jest.log`）。最初使用多余 `--` 的命令未发现测试，纠正命令后完整执行，未把该空跑当作通过。
- 完整认证回归：86 项通过（`pnpm exec playwright test --config=playwright.auth.config.ts`，`/tmp/blog-f11-auth-full.log`）。新增 14 项实际 MySQL／HTTP 测试覆盖一次消费、并发错误计数、过期／投递状态／重放、用户删除／邮箱重新绑定、重发不清空校验额度、两类额度、服务端来源 IP、旧会话与新旧密码、数据库故障回滚。
- 测试夹具修正：MySQL DROP TRIGGER 不支持 Prisma prepared statement 协议，改用 Prisma CLI stdin 执行测试 DDL，保证故障触发器在 finally 中清理。首次失败遗留的触发器仅从本轮专用库清理；最终完整回归通过。
- TypeScript：`pnpm exec tsc --noEmit --incremental false` 通过。lint 通过，保留 10 项既有 Hook 依赖警告，日志 `/tmp/blog-f11-lint.log`。
- 生产构建：`pnpm build` 通过，日志 `/tmp/blog-f11-build.log`；保留既有 Browserslist 数据过期提示。构建使用专用测试库及测试密钥。
- 数据库：新增字段 SQL 只应用于本轮专用 `*_auth_test` 数据库；Prisma schema diff 返回 0（无差异）。测试／构建显式覆盖 DATABASE_URL 为该库；未对应用库执行 DDL 或密码更新。
- 日志检查：完整认证日志中没有本次重置测试明文密码、bcrypt 摘要或注入的私有故障诊断。测试 SMTP 仅本机捕获，外部邮箱未发送；真实 SMTP 与实际收件仍待配置验收。
- 清理核对：最终专用库中本次 consume- 测试用户、PasswordResetChallenge、reset: 限流桶和故障触发器均为 0。
- 作者自审：核对 HMAC 的邮箱／挑战绑定、常量时间比较、事务内错误计数提交、用户行锁和删除判断、三项成功写入的原子性、登录版本快照、getActor 再校验、API 错误脱敏及迁移先后顺序。侧聊禁用子代理，没有独立审阅者。

## 交付与启用

- F11 初次以隔离分支交付；随后按用户明确指示快进合入 dev（d4d8d54）。本地 localhost:3306/blog 已按顺序应用 F10 建表 SQL 与 F11 新字段 SQL，并生成 Prisma 客户端；缺少 sessionVersion 的旧 JWT 要求重新登录。
- F12 页面入口和完整浏览器找回流程为下一小功能；当前接口与自动化回归已具备页面接入条件。

## 按用户要求回到 dev

- 用户指示：“你直接在dev开发就行了啊，不用拆分支，另外你一步一步开发”。后续直接在主工作目录 dev 上按小功能逐项开发、验证、提交，不创建功能分支或工作树。
- 快进合并保留 F11 原提交；主目录原有 .gitignore 修改及未跟踪脚本保留，不纳入本次提交。
- 连接确认目标为 localhost:3306/blog，执行前确认两项结构均缺失，只应用已审阅的增量 SQL；没有执行 db push，也没有修改已有账号密码或角色。新 Prisma 客户端已能读取 sessionVersion 和验证码表。
- dev 验证：346 项 Jest、TypeScript 和差异格式检查通过；本地开发服务重启后，/login 与匿名 /api/auth/session 均返回 200。此次仅核对集成与运行状态，没有使用实际账号密码尝试登录。
