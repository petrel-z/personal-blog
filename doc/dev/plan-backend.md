# 后台开发计划

版本：v1.0
日期：2026-04-05
模块：后台管理系统（Admin Panel）

---

## 一、项目概述

后台面向博主，提供文章管理、评论审核、数据分析、系统配置等功能。

### 1.1 技术栈

- Next.js 14 App Router
- Tailwind CSS + Shadcn/ui
- React Hook Form + Zod
- next-auth (认证)
- 统一 fetch 客户端 (`/client/api`)

### 1.2 页面清单

| 页面 | 路径 | 优先级 |
|------|------|--------|
| 登录页 | `/login` | P0 |
| 仪表盘 | `/admin/dashboard` | P0 |
| 文章列表 | `/admin/posts` | P0 |
| 文章编辑 | `/admin/posts/[id]` | P0 |
| 分类管理 | `/admin/categories` | P0 |
| 标签管理 | `/admin/tags` | P0 |
| 评论管理 | `/admin/comments` | P0 |
| 热门文章 | `/admin/stats/popular` | P1 |
| 阅读趋势 | `/admin/stats/views` | P1 |
| 系统设置 | `/admin/settings` | P1 |
| 敏感词管理 | `/admin/sensitive-words` | P2 |
| 审计日志 | `/admin/audit-logs` | P2 |

---

## 二、任务模块

---

### M1: 登录与认证 (P0)

#### 1.1 登录页面

**任务：**
- 创建 `LoginForm` 组件
  - 邮箱、密码输入
  - 图片验证码 (4位)
  - 记住登录状态
- 创建 `CaptchaInput` 组件
  - 显示验证码图片
  - 点击刷新
- 实现登录错误提示
  - 用户名或密码错误
  - 验证码错误
  - 登录失败次数过多

**文件：**
```
src/app/(admin)/_components/
├── LoginForm.tsx
└── CaptchaInput.tsx
```

**依赖：** API `/api/auth/login`

#### 1.2 认证状态

**任务：**
- 创建 `AuthProvider` (客户端)
- 实现会话检查与刷新
- 实现登出功能

**文件：**
```
src/app/(admin)/_components/
├── AuthProvider.tsx
└── LogoutButton.tsx
```

#### 1.3 中间件集成

**任务：**
- 确认 `middleware.ts` 配置
- `/admin/*` 需要认证
- `/login` 已登录则跳转 dashboard

---

### M2: 仪表盘 (P0)

#### 2.1 统计数据

**任务：**
- 创建 `StatsOverview` 组件
  - 总文章数、已发布、草稿、已删除
  - 总评论数、待审核
  - 总阅读量、总点赞
- 创建 `StatsTrend` 组件
  - 本周阅读量、点赞、评论趋势

**文件：**
```
src/app/(admin)/_components/
├── StatsOverview.tsx
└── StatsTrend.tsx
```

**依赖：** API `/api/stats` (overview)

#### 2.2 热门文章列表

**任务：**
- 创建 `PopularPostsList` 组件
  - 显示：标题、阅读量、点赞数
  - 点击跳转文章编辑

#### 2.3 最新评论

**任务：**
- 创建 `RecentComments` 组件
  - 显示：内容、昵称、状态、时间
  - 快速审核操作

#### 2.4 仪表盘页面

**任务：**
- 更新 `/admin/dashboard/page.tsx`
- 集成所有统计组件
- 布局：侧边栏 + 主内容区

**文件：**
```
src/app/(admin)/admin/dashboard/
└── page.tsx
```

---

### M3: 文章管理 (P0)

#### 3.1 文章列表

**任务：**
- 创建 `PostTable` 组件
  - 列：标题、分类、标签、状态、发布时间、阅读量、评论数、操作
  - 筛选：状态、分类、标签、关键词
  - 排序：时间、标题
  - 分页
  - 批量选择
- 创建 `PostFilters` 组件
  - 状态筛选下拉
  - 分类筛选
  - 标签筛选
  - 搜索框

**文件：**
```
src/app/(admin)/_components/
├── PostTable.tsx
├── PostFilters.tsx
└── PostStatusBadge.tsx
```

**依赖：** API `/api/posts` (admin)

#### 3.2 文章编辑器

**任务：**
- 创建 `PostEditor` 组件
  - 标题输入
  - Markdown 编辑器 (react-markdown 实时预览)
  - 封面图上传
  - 分类选择 (单选)
  - 标签选择 (多选)
  - 摘要输入
  - SEO 字段 (标题、描述、关键词)
- 创建 `MarkdownEditor` 组件
  - 工具栏：粗体、斜体、代码、链接、图片
  - 实时预览切换
  - 代码高亮
- 创建 `ImageUploader` 组件
  - 拖拽上传
  - 粘贴上传
  - 进度显示
  - 预览

**文件：**
```
src/app/(admin)/_components/
├── PostEditor.tsx
├── MarkdownEditor.tsx
├── ImageUploader.tsx
├── CategorySelect.tsx
└── TagSelect.tsx
```

**依赖：** API `/api/upload`

#### 3.3 自动保存

**任务：**
- 创建 `useAutoSave` hook
  - 每 30 秒检测变更
  - 保存状态提示 (右上角)
  - 网络异常处理
- 创建 `SaveStatus` 组件
  - 显示：保存中、已保存、保存失败

**文件：**
```
src/app/(admin)/_hooks/
└── useAutoSave.ts
```

#### 3.4 退出确认

**任务：**
- 创建 `UnsavedChangesDialog` 组件
  - 检测未保存修改
  - 选项：保存草稿、放弃修改、取消
- 快捷键：Ctrl/Cmd + S 手动保存

#### 3.5 文章操作

**任务：**
- 创建 `PostActions` 组件
  - 发布 / 下架
  - 置顶 / 取消置顶
  - 移至回收站
  - 批量操作
- 创建 `PublishDialog` 组件
  - 发布确认
  - 选择发布时间

#### 3.6 文章页面

**任务：**
- 更新 `/admin/posts/page.tsx` (列表)
- 创建 `/admin/posts/[id]/page.tsx` (编辑)
- 创建 `/admin/posts/new/page.tsx` (新建)

**文件：**
```
src/app/(admin)/admin/posts/
├── page.tsx (列表)
├── new/
│   └── page.tsx
└── [id]/
    └── page.tsx
```

---

### M4: 分类管理 (P0)

#### 4.1 分类列表

**任务：**
- 创建 `CategoryTable` 组件
  - 列：名称、slug、描述、文章数、操作
  - 新建/编辑/删除
- 创建 `CategoryDialog` 组件
  - 名称、slug、描述
  - 唯一性校验

**文件：**
```
src/app/(admin)/_components/
├── CategoryTable.tsx
└── CategoryDialog.tsx
```

**依赖：** API `/api/categories`

#### 4.2 删除保护

**任务：**
- 实现分类删除校验
- 如果有关联文章，提示先移动或删除

---

### M5: 标签管理 (P0)

#### 5.1 标签列表

**任务：**
- 创建 `TagTable` 组件
  - 列：名称、slug、文章数、操作
  - 新建/编辑/删除
- 创建 `TagDialog` 组件

**文件：**
```
src/app/(admin)/_components/
├── TagTable.tsx
└── TagDialog.tsx
```

**依赖：** API `/api/tags`

---

### M6: 评论管理 (P0)

#### 6.1 评论列表

**任务：**
- 创建 `CommentTable` 组件
  - 列：内容、昵称、文章、状态、时间、IP、操作
  - 筛选：状态、文章、关键词
  - 分页
- 创建 `CommentStatusBadge` 组件

**文件：**
```
src/app/(admin)/_components/
├── CommentTable.tsx
└── CommentStatusBadge.tsx
```

**依赖：** API `/api/comments` (admin)

#### 6.2 评论审核

**任务：**
- 创建 `CommentActions` 组件
  - 查看详情
  - 批准 / 拒绝
  - 删除
- 创建 `CommentDetailDialog` 组件
  - 显示完整信息 (IP、User-Agent)
  - IP 后三位掩码

#### 6.3 批量操作

**任务：**
- 实现批量审核
- 实现批量删除

#### 6.4 评论页面

**任务：**
- 更新 `/admin/comments/page.tsx`

---

### M7: 数据统计 (P1)

#### 7.1 阅读量趋势

**任务：**
- 创建 `ViewTrendChart` 组件
  - 折线图展示
  - 时间范围选择 (7d/30d/90d/1y)
  - 显示总量、日均、增长率

**文件：**
```
src/app/(admin)/_components/
└── ViewTrendChart.tsx
```

**依赖：** API `/api/stats/views`

#### 7.2 热门文章排行

**任务：**
- 创建 `PopularPostsChart` 组件
  - 柱状图或列表
  - 热度排序
  - 时间范围切换

#### 7.3 统计页面

**任务：**
- 创建 `/admin/stats/views/page.tsx`
- 创建 `/admin/stats/popular/page.tsx`

---

### M8: 系统设置 (P1)

#### 8.1 设置表单

**任务：**
- 创建 `SettingsForm` 组件
  - 博客设置：名称、描述、关键词、Logo
  - SEO 设置：标题、描述、OG图片
  - 社交链接：GitHub、Twitter、微博
  - 评论设置：是否自动审核、是否需要邮箱

**文件：**
```
src/app/(admin)/_components/
└── SettingsForm.tsx
```

**依赖：** API `/api/settings`

#### 8.2 设置页面

**任务：**
- 更新 `/admin/settings/page.tsx`

---

### M9: 敏感词管理 (P2)

#### 9.1 敏感词列表

**任务：**
- 创建 `SensitiveWordTable` 组件
  - 列：词汇、分类、状态、操作
  - 筛选：分类、状态
  - 分页

**文件：**
```
src/app/(admin)/_components/
└── SensitiveWordTable.tsx
```

**依赖：** API `/api/sensitive-words`

#### 9.2 敏感词操作

**任务：**
- 创建 `SensitiveWordDialog` 组件
  - 添加/编辑敏感词
- 创建 `ImportDialog` 组件
  - CSV/TXT 文件导入
  - 导入结果统计

#### 9.3 敏感词页面

**任务：**
- 创建 `/admin/sensitive-words/page.tsx`

---

### M10: 审计日志 (P2)

#### 10.1 日志列表

**任务：**
- 创建 `AuditLogTable` 组件
  - 列：用户、操作、目标、IP、时间
  - 筛选：用户、操作类型、时间范围
  - 分页

**文件：**
```
src/app/(admin)/_components/
└── AuditLogTable.tsx
```

**依赖：** API `/api/audit-logs`

#### 10.2 日志页面

**任务：**
- 创建 `/admin/audit-logs/page.tsx`

---

### M11: 后台布局 (P0)

#### 11.1 侧边栏

**任务：**
- 创建 `AdminSidebar` 组件
  - Logo
  - 导航菜单：仪表盘、文章、评论、统计、设置
  - 当前路由高亮
  - 移动端折叠

**文件：**
```
src/app/(admin)/_components/
└── AdminSidebar.tsx
```

#### 11.2 管理顶栏

**任务：**
- 创建 `AdminHeader` 组件
  - 面包屑
  - 用户信息
  - 登出按钮
  - 快捷操作

**文件：**
```
src/app/(admin)/_components/
└── AdminHeader.tsx
```

#### 11.3 布局集成

**任务：**
- 更新 `/admin/layout.tsx`
- 集成 Sidebar + Header
- 响应式布局

---

## 三、依赖关系

```
M1 (登录) ────► M11 (布局)
                  │
M2 (仪表盘) ─────► M11
                  │
M3 (文章管理) ────► M4 (分类) ────► M11
     │              │
     └──► M5 (标签) ────► M11
     │
     └──► M6 (评论) ────► M11
     │
     └──► M7 (统计) ────► M11
     │
     └──► M8 (设置) ────► M11
     │
     └──► M9 (敏感词) ───► M11
     │
     └──► M10 (审计日志) ───► M11
```

---

## 四、验收标准

- [ ] 登录功能正常，验证码有效
- [ ] 未登录访问 /admin/* 自动跳转登录页
- [ ] 仪表盘统计数据正常显示
- [ ] 文章创建/编辑/删除正常
- [ ] 自动保存草稿功能正常 (30秒间隔)
- [ ] 分类/标签增删改查正常
- [ ] 评论审核/删除正常
- [ ] 敏感词增删改查、导入正常
- [ ] 审计日志正常记录和展示
- [ ] 系统设置保存成功
- [ ] 移动端布局正常
- [ ] 响应时间 < 1秒

---

## 五、技术债务

- [ ] 文章回收站功能 (恢复、永久删除)
- [ ] 多用户支持 (角色权限)
- [ ] 操作撤销/重做
- [ ] 编辑器草稿历史
