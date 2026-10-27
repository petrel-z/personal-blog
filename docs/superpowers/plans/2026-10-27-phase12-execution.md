# F12 执行记录

- 当前请求：用户指出登录页没有忘记密码入口；在 dev 基线 503ace5 接入 F10/F11，完成 F12 页面功能。
- 按用户要求，源码直接在 dev 开发，逐项开发、验证、提交，不创建分支或工作树；本侧聊禁止子代理，作者单独自审。
- Ruling：沿用已批准的 F12 表单与接口设计，使用本执行记录作为账本，不重新展开产品设计。
- Pre-flight：申请接口接收 email/captchaId/captchaCode，返回统一成功提示和 retryAfterSeconds；确认接口接收 email/code/newPassword；两者只使用服务端 IP。验证码用途必须为 password-reset。
- Ruling：浏览器刷新仅保留无身份信息的冷却截止时间；恢复表单用“已有邮件验证码”允许用户重新输入邮箱继续第二步，邮箱、邮件验证码与密码均只保存在内存。
- Ruling：原认证回归保留无 SMTP 配置场景，新增独立 recovery Playwright 配置，由测试进程启动 TLS 捕获 SMTP 和 3018 专用应用。源码在 dev 修改，运行型验证使用临时文件副本避免覆盖正在运行的 3000 服务构建缓存；没有额外 Git 分支／工作树。
- RED 测试目标：入口可达、实际邮件到密码登录闭环、错误／过期码、密码校验、刷新冷却和隐私存储、重发新图片验证码、网络重试、防重复发送、服务不可用与限流、存储禁用和移动端布局。

## 实现与回归

- RED：先运行入口完整流程，登录页缺少“忘记密码？”链接导致失败；再运行全部 9 项浏览器测试，均因入口／表单缺失失败（/tmp/blog-f12-red.log、/tmp/blog-f12-all-red.log）。
- GREEN：登录按钮下方新增入口，/forgot-password 两步表单复用现有 captcha hook、邮箱／密码规则和 F10/F11 接口。支持已有邮件验证码继续、重新发送前填写新图片验证码、更换邮箱、成功返回登录。
- 防重复：请求开始前用同步 ref 加锁，所有相关表单随请求禁用；请求失败刷新已消费的图片验证码，保留邮箱便于重试；确认失败保留内存输入，网络请求超时可重试。
- 冷却与隐私：发送和校验冷却分别读取服务端 retryAfterSeconds，只持久化截止时间；刷新时重新读取，存储禁用时仍可使用内存流程。验证码、邮箱、密码不进入 localStorage/sessionStorage 或 URL；成功后清空敏感表单状态。
- 测试夹具纠正：实际 Nodemailer 中文纯文本部分使用 Base64，HTML 部分才是 quoted-printable；测试按 MIME 文本部分编码解码。页面错误断言限定 main 区域，避免和 Next 路由播报器的 alert 冲突。登录闭环使用显式赋予 admin 的隔离测试账号，验证进入 /admin/dashboard 和有效会话。
- 浏览器回归 9 项全部通过（/tmp/blog-f12-green.log），覆盖真实 TLS SMTP 捕获邮件到重置／登录、错误和过期码、密码确认与 UTF-8 长度、刷新冷却及敏感存储、防重复发送、重发、网络重试、服务异常、存储禁用及移动端无横向溢出。
- 346 项 Jest、TypeScript 与 lint 通过；lint 保留 10 项既有 Hook 依赖警告。已查看 375px 移动端截图 /tmp/blog-f12-mobile.png，长邮箱正常换行，表单与按钮无截断。
- Ruling：独立 playwright.recovery.config.ts 复用认证测试的隔离库保护，SMTP／3018 应用均由测试夹具启动与清理；拒绝复用已占用端口，关闭网络追踪，避免把测试验证码／密码请求体保留到 trace。原认证配置保持无 SMTP 情况，用于原有失败边界回归。
- 作者自审：按 code-reviewer 清单检查入口、两步切换、共享校验、错误／限流、同步防重入、刷新后的恢复、敏感输入生命周期、测试边界与现有 UI 样式；侧聊不允许子代理，无独立审阅者。

- 完整既有认证回归 86 项通过（/tmp/blog-f12-auth.log）；主目录运行中的 /login 和 /forgot-password HTTP 200，前者实际渲染 /forgot-password 链接，后者渲染注册邮箱表单。

## 验收边界

- 本次源码、测试与计划均在 dev；验证副本不含额外 Git 分支，且显式使用专用测试数据库，未改变用户账号密码或角色。
- 本地真实 SMTP 与 AUTH_CODE_SECRET 未配置时，申请接口返回服务不可用；页面保留输入并允许重试。真实邮箱收信仍待实际服务配置，不将捕获邮件验收等同于服务商投递验收。

- 生产构建已执行并失败（退出 1，/tmp/blog-f12-build.log）：src/app/layout.tsx 的既有 next/font Inter 从 fonts.gstatic.com 下载时连续 ETIMEDOUT，最终报告 Failed to fetch Inter from Google Fonts。需在字体下载网络恢复后重跑构建；不把本次构建记为通过。
- 最终交付核对：7 个实现／测试文件与通过验证的临时副本逐一校验内容一致；隔离库中的 recovery- 测试用户、PasswordResetChallenge 和 reset: 限流桶均已清理为 0。原有 .gitignore 修改及未跟踪工具脚本未纳入本次提交。
