# 后台界面统一改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将已确认的 26 张原型落实为可用的认证及后台页面，覆盖全部 18 个相关路由（含现有找回密码页）、关键状态和移动端布局。

**Architecture:** 使用后台独立 CSS 主题与共用组件承载布局、导航、表格、状态、表单和弹窗。保留 NextAuth、权限判断和现有 API 契约。真实数据驱动指标；无数据、失败、加载状态分别呈现。

**Tech Stack:** Next.js 14 / React 18 / TypeScript / Tailwind / Radix Dialog / Lucide / 现有 Markdown 编辑器。

**Spec:** `output/admin-ui-2026-10-27/README.md`、同目录 26 张 SVG 原型（按用户要求 git 忽略）。本计划记录可版本化实施要求。

## Global Constraints

- 在现有 dev 分支工作；分阶段提交，提交说明中文；不自动推送远程。
- 不提交 output/、环境变量或其他任务的未跟踪文件。
- 暖白 #F7F8F6、白卡片、墨黑 #20252B、蓝色 #4167D5；侧栏 232px、顶栏 74px、圆角 6–10px。
- 样式仅作用于认证和后台，不改变公开博客的主题。
- 登录邮箱、密码、图形验证码和注册确认密码保留；普通会员不获得后台权限。
- 所有业务操作必须继续遵循权限；管理员和会员权限只读。
- 适配桌面与 390px 移动端；表单有标签、反馈有语义、抽屉支持键盘关闭与焦点返回。

## Review Focus

- 无权限和失效会话不能通过新布局暴露内容（现有权限测试 + 集成验证）。
- API 异常不能伪装成空数据或成功（状态组件与重试验证）。
- 长标题、多角色、大表格与移动端不能产生页面级横向溢出（浏览器验证）。
- 保存失败保留编辑内容，验证码刷新及锁定倒计时仍可恢复（认证与表单集成测试）。
- 管理页与公开页主题隔离，Radix portal 也必须应用后台配色（视觉验证）。

### Task 1: 统一主题、布局及导航

**Files:** `src/components/admin/*`, `src/app/(admin)/_components/Admin{Shell,Sidebar,Header}.tsx`, `src/app/globals.css`, `tests/admin-navigation.test.ts`。
**Interfaces:** 共用 AdminPageHeader、AdminPanel、AdminState、AdminDialog、AdminPagination、AdminBadge；导航配置提供按权限分组和中文面包屑。
- [x] 为中文动态路由面包屑、权限过滤与未知路径写行为测试并观察失败。
- [x] 实现局部主题、桌面分组导航、移动抽屉和可访问操作。
- [x] 运行导航及访问边界测试、typecheck；中文提交。

### Task 2: 登录、注册与无权限页

**Files:** `src/components/admin/AuthLayout.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/forbidden/page.tsx`, 登录与验证码组件。
**Interfaces:** 使用 Task 1 的主题、表单、按钮和反馈样式，认证契约不变。
- [x] 按双栏品牌画面重排认证页面，移动端单列；错误与成功通知可访问。
- [x] 保留注册、验证码、登录锁定行为，完善输入标签和密码显隐。
- [x] 运行相关认证用例与视觉检查；中文提交。

### Task 3: 文章、分类、标签与评论

**Files:** 后台 posts/new、posts/[id]、posts、categories、tags、comments 页面及内容相关组件。
**Interfaces:** 共用表格、筛选、弹窗、分页、状态组件，使用现有 CRUD API。
- [x] 列表分层、搜索/筛选、批量动作及移动布局，保留权限与数据状态。
- [x] 统一新建/编辑器正文与右侧设置布局、封面/标签、保存发布入口；保持 Markdown 行为。
- [x] 检查表单验证、失败恢复、空列表和编辑结果；中文提交。

### Task 4: 工作台、统计与系统管理

**Files:** dashboard、stats、users、roles、sensitive-words、audit-logs、settings 页面及其组件。
**Interfaces:** 共用 UI 组件和已有统计、用户、角色、系统 API。
- [x] 工作台真实指标/趋势/待办，阅读统计与排行榜保持周期口径。
- [x] 管理表格和权限表单统一；设置拆为基本信息、社交链接、评论设置，所有字段可保存。
- [x] 验证权限保护、只读角色与保存失败处理；中文提交。

### Task 5: 全面验证与修整

**Files:** `tests/integration/admin-ui.spec.ts`（若需要）、项目相关回归用例、实施记录。
- [x] 运行 typecheck、完整 Jest、生产构建和适用的隔离数据库集成用例。
- [x] 通过浏览器检查登录、后台桌面、移动端与关键表单；逐项核对 18 个页面与原型。
- [x] 独立审查整体差异并修复问题，中文提交验证记录。

## 执行记录

- 用户已批准原型并要求开始实现；直接执行，无需再批准同一设计。
- 工作目录现有未跟踪 `.agents/skills/find-skills/scripts/` 属于其他工作，不纳入提交。


## 交付与验证记录（2026-10-27）

- 已实现全部 18 个路由：login、register、forgot-password、forbidden，以及 admin 下的 dashboard、posts、posts/new、posts/[id]、categories、tags、comments、stats/views、stats/popular、users、roles、sensitive-words、audit-logs、settings。
- 统一暖白主题、桌面侧栏、中文面包屑、移动抽屉、表格卡片化、表单、反馈与 Radix 弹窗；设置提供三分组与当前填写内容预览。
- 内容编辑器保留 Markdown、封面、标签、分类、摘要、置顶、创建时间、状态及上传；按账号和文章保存本标签页的未保存草稿。失败保留输入，离开时提醒，再次打开可以恢复。
- 文章列表接入服务器搜索并保留权限范围。工作台与统计新增真实阅读趋势、周期排行接口，公开的原统计接口保持兼容。统计按北京时间，累计与周期口径分别标注。
- 修复实测发现的未分类文章相邻查询非法空值条件；工作台与排行榜使用现有详情 API 支持的文章 ID 链接。
- 独立审查发现的编辑器历史后退丢稿、已发布文章缺少发布权限仍可编辑问题已修复；相应草稿、权限测试通过。弹窗描述采用独立 ID，表格危险操作按钮保持白字对比度。

### 自动化证据

- `pnpm exec jest --runInBand`：28 个测试套件、371 项测试通过。
- `NEXT_DIST_DIR=.next-ui-test pnpm exec playwright test --config playwright.auth.config.ts tests/integration/admin-ui.spec.ts tests/integration/forms-compatibility.spec.ts tests/integration/admin-roles.spec.ts tests/integration/role-permissions.spec.ts tests/integration/admin-user-create.spec.ts tests/integration/admin-membership.spec.ts`：33 项通过。
- 上述浏览器测试覆盖 18 路由 × 1440/390px，无页面横向溢出、无客户端未捕获异常；移动抽屉 Escape 和焦点返回；编辑器保存失败、刷新恢复、真实保存；创建用户、角色分配、权限变更、失败保留输入、自降权限与只读边界。
- `pnpm exec tsc --noEmit --incremental false` 通过。
- `NEXT_DIST_DIR=.next-ui-build pnpm build` 通过；仅有原公开页面的既存 React Hook 依赖警告与 Browserslist 数据更新提示。
- `git diff --check` 通过。

### 视觉证据与边界

- 实际浏览器截图位于忽略目录 `output/admin-implementation/`，逐页核对桌面及移动布局，并查看完整编辑器、登录与设置预览。
- 测试使用 `.env.auth-test` 明确指定的隔离数据库；补齐该库缺失的既存 schema 字段，未修改开发数据库。构建和测试使用独立 Next 目录，避免干扰已有开发服务。
- 原型样例数据未写入产品页面；空库展示真实空状态。评论搜索、敏感词状态筛选明确限定当前页。
- 未提交 output、环境配置及其他任务的 skill scripts；未推送远程。
