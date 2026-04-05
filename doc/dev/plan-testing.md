# 测试开发计划

版本：v1.0
日期：2026-04-05
模块：测试体系建设

---

## 一、项目概述

建立完整的测试体系，包括单元测试、集成测试和 E2E 测试，确保代码质量和功能正确性。

### 1.1 测试策略

```
┌─────────────────────────────────────────────┐
│                  E2E 测试                     │
│  Playwright - 关键用户旅程                   │
├─────────────────────────────────────────────┤
│                  集成测试                    │
│  API 端点、数据库操作、认证流程               │
├─────────────────────────────────────────────┤
│                  单元测试                    │
│  工具函数、业务逻辑、组件                    │
└─────────────────────────────────────────────┘
```

### 1.2 测试工具

| 类型 | 工具 | 用途 |
|------|------|------|
| 单元测试 | Vitest | 工具函数、业务逻辑 |
| 集成测试 | Vitest + Prisma | API 端点、数据库 |
| E2E 测试 | Playwright | 关键用户旅程 |
| 组件测试 | Vitest + Testing Library | React 组件 |
| 覆盖率 | Vitest Coverage | 代码覆盖率统计 |

### 1.3 目录结构

```
blog/
├── __tests__/
│   ├── unit/
│   │   ├── utils/
│   │   ├── lib/
│   │   └── components/
│   ├── integration/
│   │   ├── api/
│   │   └── db/
│   └── e2e/
│       ├── fixtures/
│       └── specs/
├── playwright.config.ts
└── vitest.config.ts
```

---

## 二、任务模块

---

### M1: 测试基础设施 (P0)

#### 1.1 Vitest 配置

**任务：**
- 安装依赖：`vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`
- 创建 `vitest.config.ts`
- 配置 `tsconfig.json` 测试相关路径

**文件：**
```
vitest.config.ts
```

**配置项：**
- 测试环境：node / jsdom
- 路径别名：`@/*` → `src/*`
- 覆盖率阈值：80%
- 全局 teardown

#### 1.2 Playwright 配置

**任务：**
- 安装依赖：`playwright`, `@playwright/test`
- 创建 `playwright.config.ts`
- 配置浏览器：Chromium, Firefox, WebKit
- 配置截图/视频输出

**文件：**
```
playwright.config.ts
```

**配置项：**
- Base URL: `http://localhost:3000`
- 超时：30秒
- 截图：失败时
- 视频：失败时

#### 1.3 测试工具函数

**任务：**
- 创建 `test-utils.ts`
- 创建 `renderWithProviders` (测试组件)
- 创建 API mock helpers

**文件：**
```
__tests__/
└── utils/
    ├── test-utils.ts
    └── mocks/
        ├── api.ts
        └── db.ts
```

---

### M2: 单元测试 (P0)

#### 2.1 工具函数测试

**任务：**
- `formatDate` - 日期格式化
- `slugify` - slug 生成
- `truncate` - 文本截断
- `cn` (clsx) - 类名合并
- `debounce` - 防抖函数
- `getReadingTime` - 阅读时间计算

**文件：**
```
__tests__/unit/utils/
├── formatDate.test.ts
├── slugify.test.ts
├── truncate.test.ts
├── debounce.test.ts
└── getReadingTime.test.ts
```

#### 2.2 Zod 验证测试

**任务：**
- `post.validation` - 文章数据验证
- `comment.validation` - 评论数据验证
- `category.validation` - 分类数据验证

**文件：**
```
__tests__/unit/validations/
├── post.validation.test.ts
├── comment.validation.test.ts
└── category.validation.test.ts
```

#### 2.3 Service 层测试

**任务：**
- `post.service` - 文章业务逻辑
  - `getPosts` - 获取文章列表
  - `createPost` - 创建文章
  - `updatePost` - 更新文章
  - `deletePost` - 软删除
  - `publishPost` - 发布文章
  - `getTrendingPosts` - 热门文章
  - `searchPosts` - 搜索

- `comment.service` - 评论业务逻辑
  - `createComment` - 创建评论
  - `approveComment` - 审核通过
  - `checkSensitiveWords` - 敏感词检测

- `category.service` - 分类业务逻辑
  - `createCategory` - 创建分类
  - `deleteCategory` - 删除分类 (检查关联)

**文件：**
```
__tests__/unit/services/
├── post.service.test.ts
├── comment.service.test.ts
└── category.service.test.ts
```

#### 2.4 分页工具测试

**任务：**
- `paginate` - 分页工具

**文件：**
```
__tests__/unit/utils/
└── pagination.test.ts
```

---

### M3: 集成测试 (P0)

#### 3.1 API 端点测试

**任务：**
- `GET /api/posts` - 文章列表
- `GET /api/posts/[id]` - 文章详情
- `POST /api/posts` - 创建文章
- `PATCH /api/posts/[id]` - 更新文章
- `DELETE /api/posts/[id]` - 删除文章
- `POST /api/posts/[id]/like` - 点赞
- `POST /api/posts/[id]/view` - 增加浏览量
- `GET /api/posts/trending` - 热门文章

**文件：**
```
__tests__/integration/api/
├── posts.test.ts
├── comments.test.ts
├── categories.test.ts
└── tags.test.ts
```

#### 3.2 数据库测试

**任务：**
- Prisma client 初始化
- 数据库连接/断开
- 每个测试用例前重置数据库状态

**文件：**
```
__tests__/integration/db/
├── setup.ts
├── teardown.ts
└── posts.test.ts
```

#### 3.3 认证流程测试

**任务：**
- 登录成功
- 登录失败 (密码错误)
- 登录失败 (验证码错误)
- Token 过期
- 登出

**文件：**
```
__tests__/integration/api/
└── auth.test.ts
```

---

### M4: E2E 测试 (P0)

#### 4.1 前台关键旅程

**任务：**
- **首页 → 文章详情**
  1. 访问首页
  2. 点击文章标题
  3. 进入文章详情页
  4. 验证文章内容显示

- **文章 → 评论**
  1. 进入文章详情页
  2. 滚动到评论区
  3. 填写评论表单
  4. 提交评论
  5. 验证评论成功提示

- **搜索功能**
  1. 点击搜索按钮
  2. 输入关键词
  3. 验证搜索结果

- **分类浏览**
  1. 进入分类总览页
  2. 点击某个分类
  3. 验证分类文章列表

- **暗黑模式**
  1. 切换暗黑模式
  2. 刷新页面
  3. 验证主题保持

**文件：**
```
__tests__/e2e/
└── specs/
    ├── home.spec.ts
    ├── post.spec.ts
    ├── comment.spec.ts
    ├── search.spec.ts
    ├── category.spec.ts
    └── theme.spec.ts
```

#### 4.2 后台关键旅程

**任务：**
- **登录 → 仪表盘**
  1. 访问登录页
  2. 输入邮箱密码验证码
  3. 点击登录
  4. 进入仪表盘

- **创建文章**
  1. 登录后台
  2. 进入文章列表
  3. 点击新建文章
  4. 填写标题、内容
  5. 选择分类标签
  6. 保存草稿
  7. 发布文章

- **编辑文章**
  1. 登录后台
  2. 进入文章列表
  3. 点击编辑某篇文章
  4. 修改内容
  5. 保存

- **评论审核**
  1. 登录后台
  2. 进入评论管理
  3. 找到待审核评论
  4. 点击通过/拒绝

- **分类管理**
  1. 登录后台
  2. 进入分类管理
  3. 创建新分类
  4. 编辑分类
  5. 删除分类

**文件：**
```
__tests__/e2e/
└── specs/
    ├── login.spec.ts
    ├── admin-post-create.spec.ts
    ├── admin-post-edit.spec.ts
    ├── admin-comment.spec.ts
    └── admin-category.spec.ts
```

#### 4.3 E2E Fixtures

**任务：**
- 创建测试用户 fixture
- 创建测试文章 fixture
- 创建测试分类/标签 fixture

**文件：**
```
__tests__/e2e/
└── fixtures/
    ├── test-user.ts
    ├── test-post.ts
    └── test-category.ts
```

---

### M5: 组件测试 (P1)

#### 5.1 通用组件测试

**任务：**
- `Button` 组件
- `Input` 组件
- `Dialog` 组件
- `Dropdown` 组件
- `Toast` 组件

**文件：**
```
__tests__/unit/components/
├── Button.test.tsx
├── Input.test.tsx
├── Dialog.test.tsx
└── Toast.test.tsx
```

#### 5.2 业务组件测试

**任务：**
- `ArticleCard` - 文章卡片
- `Pagination` - 分页器
- `CommentForm` - 评论表单
- `MarkdownEditor` - Markdown 编辑器

**文件：**
```
__tests__/unit/components/
├── ArticleCard.test.tsx
├── Pagination.test.tsx
├── CommentForm.test.tsx
└── MarkdownEditor.test.tsx
```

---

### M6: 性能测试 (P2)

#### 6.1 Lighthouse CI

**任务：**
- 配置 Lighthouse CI
- 性能阈值：LCP < 2.5s, FID < 100ms, CLS < 0.1
- 移动端/桌面端测试

#### 6.2 API 性能测试

**任务：**
- 响应时间测试
- 并发测试
- 负载测试

---

## 三、测试覆盖要求

### 核心业务覆盖率

| 模块 | 覆盖率目标 |
|------|-----------|
| Post Service | > 90% |
| Comment Service | > 85% |
| Category Service | > 85% |
| Auth 模块 | > 90% |
| 工具函数 | > 80% |
| API 端点 | 100% |

### 关键旅程覆盖

| 旅程 | 类型 | 优先级 |
|------|------|--------|
| 首页浏览 | E2E | P0 |
| 文章详情 | E2E | P0 |
| 评论提交 | E2E | P0 |
| 后台登录 | E2E | P0 |
| 文章创建 | E2E | P0 |
| 文章编辑 | E2E | P0 |
| 评论审核 | E2E | P0 |
| 分类管理 | E2E | P1 |
| 搜索功能 | E2E | P1 |
| 暗黑模式 | E2E | P1 |

---

## 四、测试脚本

### package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:all": "pnpm test && pnpm test:e2e"
  }
}
```

---

## 五、CI/CD 集成

### GitHub Actions

**任务：**
- 创建 `.github/workflows/test.yml`
- 运行单元测试 + 覆盖率
- 运行 E2E 测试 (Playwright)
- 上传覆盖率报告

**触发条件：**
- PR 创建/更新
- main 分支 push

---

## 六、验收标准

- [ ] Vitest 配置完成，测试可运行
- [ ] Playwright 配置完成，E2E 可运行
- [ ] Service 层测试覆盖率 > 80%
- [ ] 关键 API 端点 100% 覆盖
- [ ] E2E 覆盖核心用户旅程
- [ ] CI/CD 流程正常工作
- [ ] 覆盖率报告可生成

---

## 七、技术债务

- [ ] 组件测试覆盖更多业务组件
- [ ] 性能回归测试
- [ ] 视觉回归测试 (snapshot)
- [ ] API 压力测试
- [ ] 安全测试 (XSS, SQL注入)
