# 密码找回与腾讯验证码

浏览器打开腾讯验证码，取得一次性 `ticket`、`randstr`，与邮箱一起提交到
`POST /api/auth/password-reset/request`。服务端验证腾讯结果后才检查发送配额、创建邮件验证码并发送邮件。
独立的 `/api/auth/password-reset/tencent-captcha` 接口已移除；前端不能以“验证成功”的布尔值代替票据。
每次发送或重试都重新获取票据。过期、重复使用和被拒绝的票据不能发送邮件。

## 环境配置

按 `.env.example` 配置以下变量，值从腾讯云控制台获取：

- `NEXT_PUBLIC_CAPTCHA_APP_ID`：验证码应用 AppId，可以公开；必须在构建前配置。
- `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`：服务器调用腾讯云 API 的凭据。
- `APP_SCRECT_KEY`：验证码应用的 AppSecretKey。沿用已有变量拼写，和云 API SecretKey 不同。
- `AUTH_SECRET` 或 `NEXTAUTH_SECRET`：认证摘要/会话密钥。
- `AUTH_CODE_SECRET`：独立的邮件验证码 HMAC 密钥，至少 32 字节，不能与认证密钥相同。
- SMTP 配置：见 `.env.example`。生产代理应覆盖 `X-Forwarded-For`，并阻止客户端绕过代理直连应用。

腾讯验证调用限制为十秒；缺少配置、客户端 IP 不可用或云服务异常时不发送邮件，返回服务不可用。
验证被拒绝时返回人机验证失败。页面仅在邮件接口成功后进入设置密码步骤，并根据成功或限流结果开始冷却。

本地 `pnpm dev` 的发送间隔为 5 秒，发送配额窗口为 60 秒（每邮箱 5 次、每 IP 20 次）。
仅 `NODE_ENV=development` 使用短等待；生产仍为 60 秒发送间隔和 1 小时配额窗口。
开发页面使用单独的发送倒计时存储键，避免恢复之前按长窗口保存的等待时间。

### SMTP 网络连接

发送接口在创建邮件验证码前执行 SMTP 连接和认证检查。若腾讯验证、两次 `AuthRateBucket`
事务均完成，随后约十秒返回 503，应检查 SMTP 连接；尚未创建 `PasswordResetChallenge`。
浏览器或 macOS 的系统代理不会自动应用到此处的 Node SMTP 连接。

SMTP 必须通过代理访问时，在服务端环境中设置可选的 `SMTP_PROXY`，例如本地代理为
`SMTP_PROXY=http://127.0.0.1:7897`。支持 HTTP/HTTPS CONNECT，留空则直连。
代理同时用于连接认证检查和发送邮件，SMTP 的 TLS 和证书验证始终开启。
生产环境应配置该服务器实际可访问的代理；本机地址不要照搬到其他服务器。

## 测试

Jest 通过 `tests/setup-env.cjs` 设置固定的测试专用认证密钥；不用生产密钥，也不依赖本地 `.env`。
缺少密钥的错误路径仍可在具体用例中删除环境变量进行验证。

```sh
pnpm test --runInBand
pnpm typecheck
pnpm lint
pnpm exec playwright test --config playwright.tencent.config.ts
```

腾讯页面套件使用固定测试 AppId 和云脚本/API 替身，独立启动服务器，不会消费真实腾讯票据或发送邮件。
该文件从默认 Playwright 配置中排除，使用上面的专用配置运行。

具备 `.env.auth-test` 中显式隔离的 `*_auth_test` 数据库时，还可以运行：

```sh
pnpm exec playwright test --config playwright.auth.config.ts tests/integration/password-reset-issue.spec.ts tests/integration/password-reset-consume.spec.ts
pnpm exec playwright test --config playwright.recovery.config.ts
```

这两组使用真实数据库和回环地址 TLS SMTP 捕获服务器，腾讯边界使用一次性票据替身。
其中 HTTP 路由和腾讯 SDK 参数、拒绝/异常分支由 Jest 验证；真实腾讯控制台配置仍需部署环境联调。

最近本地验收：428 项 Jest、31 项数据库/邮件集成和 8 项腾讯页面测试通过；
`pnpm typecheck`、`pnpm lint` 通过，保留公共页面原有的三条 Hooks 依赖警告。
