# 阶段一：本地运行与验收

代码位于 `/Users/petrel/project/blog/blog` 的 `dev` 分支。2026-10-22 迁回时按用户要求保留未提交修改；2026-10-23 用户明确要求提交阶段一代码，再拆解阶段二需求。

## 数据库增量

本仓库没有完整的 Prisma migration 基线。`prisma/patches/20261022_auth_phase1.sql` 来自本地实际数据库与 schema 的只读比较，只创建 CaptchaChallenge、LoginAttempt、AuthRateBucket 三张表，不修改原有表。2026-10-22 已应用到本机 blog 库；该库不要重复执行此文件。

在另一环境应用前，先比较现有库与 schema，确认缺失的表，再应用相应增量；不得 reset 或接受数据丢失。应用后执行 `pnpm db:generate`。

## 自动化验收

单元测试：`pnpm test --runInBand`。

真实 MySQL 与浏览器测试使用单独的库和 3017 端口：

1. 建立一个库名以 `_auth_test` 结尾的空测试库，优先使用仅能访问该库的测试账号。
2. 复制 `.env.auth-test.example` 为 `.env.auth-test`，填入 `AUTH_TEST_DATABASE_URL` 和仅用于测试的 `AUTH_SECRET`。本地 `.env` 保持应用库配置，供测试启动前核对隔离性。
3. 仅对新建测试库同步 schema：`DATABASE_URL='<测试库连接地址>' pnpm exec prisma db push`。不要把真实连接地址提交到代码或共享日志。
4. 安装测试浏览器：`pnpm exec playwright install chromium`。
5. 执行 `pnpm exec playwright test --config=playwright.auth.config.ts`。

配置强制验证测试库名称与应用库不同、测试库以 `_auth_test` 结尾。测试进程不复用现有服务；测试用户和计数记录按所属 fixture 清理。验证码由服务按过期时间清理。Node.js 需支持 `node:util` 的 parseEnv（本次使用 Node v20.19.6）。

覆盖范围：三个认证表单的验证码刷新；失败后清空验证码并保留凭据；快速刷新和加载失败；登录缺少验证码不得查询用户或比较密码；用途隔离、到期与一次消费；注册默认 member；评论新旧字段兼容；5 次错误锁定 15 分钟、过期恢复、成功清零、不存在的账号同样计数；真实并发锁定与额度控制；当前权限和安全站内跳转。

额外检查：`pnpm typecheck`、`pnpm lint`、`pnpm build`。构建需在本工作区的测试服务退出后运行，避免同时改写 `.next`。

## 本地管理员恢复

用户指定的 QQ 邮箱已恢复 admin 角色，并按用户要求生成随机密码，保存为仓库外的私密文件（0600）。密码明文不写入代码、测试或文档。没有重设其他账号的密码，也没有把其他旧账号升级为管理员。

## 审阅范围

已单独复查 F02 的异步请求和资源回收、F03 的数据库一次消费和用途校验、F04 的失败计数提交与并发事务，以及 schema 增量。侧聊禁止子代理，本轮采用自审，未进行独立第三方审阅。

邮件找回密码和完整角色管理属于后续阶段。

## 验收结果（2026-10-22）

- Jest：13 套、168 项通过。
- Playwright／隔离 MySQL：19 项通过。
- TypeScript、Lint、生产构建：通过；保留 10 条既有 Hook 依赖警告。
- 正式本地数据上的浏览器登录：指定 QQ 账号进入 `/admin/dashboard`，17 项权限，`/api/auth/users` 返回 200；测试会话已退出。
- 之前在 3018 独立预览完成验收；迁回 dev 后使用 `http://localhost:3000/login`，迁移验证结果见执行记录。

迁回 dev 后复验：168 项单元测试及类型检查通过；`http://localhost:3000/login` 的实际管理员登录、17 项权限和用户接口验证通过。3018 独立预览已停止。所有代码保留为 dev 工作区的未提交修改，HEAD 未改变。

## 注册自动登录补充验收（2026-10-23）

- 公开注册通过 Auth.js 的 `registration` provider，在创建 member 后建立 JWT 会话并进入首页；成功后不再请求新验证码，失败时刷新并保留可重试信息。
- 注册服务统一处理参数校验、邮箱归一化、验证码消费和密码哈希；用户与 member 关系在同一事务内创建。
- 后台添加用户继续通过仅创建账号的接口，成功关闭表单且保留管理员会话；再次打开表单时获取新验证码。
- 删除无调用方的 `src/server/features/auth/index.ts` 及其中两个认证占位函数。
- 回归用例先复现“跳转登录页”和“成功后重复取码”，再验证修正。Jest 168 项、Playwright／隔离 MySQL 23 项通过；TypeScript、本次修改文件的 ESLint 及差异格式检查通过。
- 浏览器测试运行于临时源码副本、独立 `_auth_test` 数据库及 3017 端口，避免与现有开发服务共享 `.next`；测试结束后已清理临时副本和复制的环境文件。
