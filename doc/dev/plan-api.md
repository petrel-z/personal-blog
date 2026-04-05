# 后端开发计划

版本：v1.0
日期：2026-04-05
模块：API 与业务逻辑层

---

## 一、项目概述

后端提供 RESTful API 和业务逻辑层，包括文章、评论、分类、标签、统计等模块。

### 1.1 架构分层

```
API Routes (src/app/api/*)
       │
       ▼
Service Layer (src/server/features/*)
       │
       ▼
Database (Prisma) + Cache (Redis)
```

### 1.2 技术栈

- Next.js API Routes
- Prisma ORM
- NextAuth v5
- Redis (缓存/限流)
- Zod (验证)

---

## 二、任务模块

---

### M1: API 基础设施

#### 1.1 统一响应格式

**任务：**
- 创建 `ApiResponse` 类型
- 创建 `ApiError` 类
- 创建 `successResponse` / `errorResponse` 工具函数

**文件：**
```
src/server/utils/
├── response.ts
└── errors.ts
```

#### 1.2 Zod 验证 schemas

**任务：**
- 创建 `validation.ts` 统一导出
- 各模块 Zod schemas

**文件：**
```
src/shared/validations/
├── index.ts
├── post.validation.ts
├── comment.validation.ts
├── category.validation.ts
└── auth.validation.ts
```

#### 1.3 分页工具

**任务：**
- 创建 `paginate` 工具函数
- 统一分页响应格式

**文件：**
```
src/server/utils/
└── pagination.ts
```

---

### M2: 文章模块

#### 2.1 Service 层

**文件：**
```
src/server/features/post/
├── post.service.ts
├── post.types.ts
└── index.ts
```

**任务：**
- [x] `getPosts(params)` - 获取文章列表 (已实现)
- [x] `getPostById(id)` - 获取文章详情 (已实现)
- [x] `getPostBySlug(slug)` - 获取文章详情 (已实现)
- [x] `createPost(data, authorId)` - 创建文章 (已实现)
- [x] `updatePost(id, data)` - 更新文章 (已实现)
- [x] `deletePost(id)` - 软删除文章 (已实现)

**新增任务：**
- `publishPost(id)` - 发布文章
- `archivePost(id)` - 归档文章
- `restorePost(id)` - 恢复已删除文章
- `getAdminPosts(params)` - 后台文章列表 (含所有状态)
- `incrementViewCount(id)` - 增加阅读量
- `toggleLike(id, ip)` - 点赞 (防刷)
- `getTrendingPosts(timeframe)` - 获取热门文章
- `searchPosts(keyword, page)` - 搜索文章

#### 2.2 API Routes

**文件：**
```
src/app/api/posts/
├── route.ts (已实现 GET, POST)
└── [id]/
    └── route.ts (已实现 GET, PATCH, DELETE)
```

**新增任务：**
- `POST /api/posts/[id]/publish` - 发布文章
- `POST /api/posts/[id]/like` - 点赞
- `POST /api/posts/[id]/view` - 增加浏览量
- `GET /api/posts/trending` - 热门文章
- `GET /api/posts/heatmap` - 创作热力图

#### 2.3 API Routes (Admin)

**文件：**
```
src/app/api/admin/posts/
├── route.ts
└── [id]/
    ├── route.ts
    ├── publish/route.ts
    ├── restore/route.ts
    └── batch-delete/route.ts
```

**新增任务：**
- `GET /api/admin/posts` - 后台文章列表
- `POST /api/admin/posts` - 创建文章
- `PUT /api/admin/posts/[id]` - 更新文章
- `DELETE /api/admin/posts/[id]` - 删除文章
- `POST /api/admin/posts/[id]/publish` - 发布
- `POST /api/admin/posts/[id]/restore` - 恢复
- `POST /api/admin/posts/batch-delete` - 批量删除

---

### M3: 评论模块

#### 3.1 Service 层

**文件：**
```
src/server/features/comment/
├── comment.service.ts (部分实现)
├── comment.types.ts
└── index.ts
```

**任务：**
- `getComments(params)` - 获取评论列表
- `getCommentsByPostId(postId, params)` - 获取文章评论
- `createComment(data)` - 创建评论 (含敏感词检测)
- `approveComment(id)` - 审核通过
- `rejectComment(id)` - 审核拒绝
- `deleteComment(id)` - 删除评论
- `batchReviewComments(ids, action)` - 批量审核
- `toggleCommentLike(id, ip)` - 评论点赞

#### 3.2 API Routes

**文件：**
```
src/app/api/comments/
└── route.ts (已实现 GET, POST)
```

**新增任务：**
- `POST /api/admin/comments/[id]/review` - 审核评论
- `POST /api/admin/comments/batch-review` - 批量审核
- `DELETE /api/admin/comments/[id]` - 删除评论

---

### M4: 分类模块

#### 4.1 Service 层

**文件：**
```
src/server/features/category/
├── category.service.ts (已实现部分)
└── index.ts
```

**任务：**
- `getCategories()` - 获取所有分类
- `getCategoryBySlug(slug)` - 获取分类详情
- `createCategory(data)` - 创建分类
- `updateCategory(id, data)` - 更新分类
- `deleteCategory(id)` - 删除分类 (检查关联文章)
- `getCategoryWithPosts(slug, params)` - 获取分类及文章列表

#### 4.2 API Routes

**文件：**
```
src/app/api/categories/
└── route.ts (已实现 GET, POST, PATCH, DELETE)
```

---

### M5: 标签模块

#### 5.1 Service 层

**文件：**
```
src/server/features/tag/
├── tag.service.ts (已实现部分)
└── index.ts
```

**任务：**
- `getTags()` - 获取所有标签
- `createTag(data)` - 创建标签
- `updateTag(id, data)` - 更新标签
- `deleteTag(id)` - 删除标签

#### 5.2 API Routes

**文件：**
```
src/app/api/tags/
└── route.ts (已实现 GET, POST, DELETE)
```

---

### M6: 认证模块

#### 6.1 NextAuth 配置

**文件：**
```
src/server/features/auth/
├── index.ts
└── auth.ts
```

**任务：**
- 配置 Credentials provider
- 配置 JWT session
- 配置 callbacks (jwt, session)

#### 6.2 认证 API

**文件：**
```
src/app/api/auth/[...nextauth]/
└── route.ts
```

**任务：**
- `GET /api/auth/session` - 获取会话
- `POST /api/auth/providers/**` - 各 provider 登录
- `POST /api/auth/signout` - 登出

#### 6.3 后台认证 API

**文件：**
```
src/app/api/auth/
├── login/route.ts
├── me/route.ts
└── logout/route.ts
```

**任务：**
- `POST /api/auth/login` - 登录 (含验证码校验)
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/logout` - 登出

---

### M7: 验证码模块

#### 7.1 Service 层

**文件：**
```
src/server/features/captcha/
├── captcha.service.ts
└── index.ts
```

**任务：**
- `generateCaptcha(type)` - 生成验证码
- `verifyCaptcha(id, code)` - 校验验证码
- 验证码图片生成 (SVG)
- 验证码存储 (Redis, 5分钟过期)

#### 7.2 API Routes

**文件：**
```
src/app/api/captcha/
└── route.ts
```

**任务：**
- `GET /api/captcha` - 获取验证码

---

### M8: 统计模块

#### 8.1 Service 层

**文件：**
```
src/server/features/stats/
├── stats.service.ts (已实现部分)
└── index.ts
```

**任务：**
- `getOverviewStats()` - 概览统计
- `getViewStats(timeframe)` - 阅读量统计
- `getTrendingPosts(timeframe)` - 热门文章
- `getHeatmapData(year)` - 创作热力图
- `getViewTrend(timeframe)` - 阅读量趋势

#### 8.2 API Routes

**文件：**
```
src/app/api/stats/
└── route.ts (已实现)
```

**新增任务：**
- `GET /api/stats/views/trend` - 阅读量趋势
- `GET /api/stats/posts/heatmap` - 创作热力图

---

### M9: 敏感词模块

#### 9.1 Service 层

**文件：**
```
src/server/features/sensitive-word/
├── sensitive-word.service.ts
└── index.ts
```

**任务：**
- `getSensitiveWords(params)` - 获取敏感词列表
- `createSensitiveWord(data)` - 创建敏感词
- `updateSensitiveWord(id, data)` - 更新敏感词
- `deleteSensitiveWord(id)` - 删除敏感词
- `importSensitiveWords(words)` - 批量导入
- `checkContent(content)` - 内容检测 (返回是否含敏感词)

#### 9.2 API Routes

**文件：**
```
src/app/api/admin/sensitive-words/
├── route.ts
└── import/route.ts
```

**任务：**
- `GET /api/admin/sensitive-words` - 获取列表
- `POST /api/admin/sensitive-words` - 创建
- `PUT /api/admin/sensitive-words/[id]` - 更新
- `DELETE /api/admin/sensitive-words/[id]` - 删除
- `POST /api/admin/sensitive-words/import` - 导入

---

### M10: 系统设置模块

#### 10.1 Service 层

**文件：**
```
src/server/features/settings/
├── settings.service.ts
└── index.ts
```

**任务：**
- `getSettings()` - 获取所有设置
- `updateSettings(data)` - 更新设置
- `getSettingByKey(key)` - 获取单个设置

#### 10.2 API Routes

**文件：**
```
src/app/api/admin/settings/
└── route.ts
```

**任务：**
- `GET /api/admin/settings` - 获取设置
- `PUT /api/admin/settings` - 更新设置

---

### M11: 审计日志模块

#### 11.1 Service 层

**文件：**
```
src/server/features/audit-log/
├── audit-log.service.ts
└── index.ts
```

**任务：**
- `createAuditLog(data)` - 创建日志
- `getAuditLogs(params)` - 获取日志列表

#### 11.2 API Routes

**文件：**
```
src/app/api/admin/audit-logs/
└── route.ts
```

**任务：**
- `GET /api/admin/audit-logs` - 获取日志列表

---

### M12: 搜索模块

#### 12.1 Service 层

**文件：**
```
src/server/features/search/
├── search.service.ts
└── index.ts
```

**任务：**
- `searchPosts(keyword, page, pageSize)` - 搜索文章
- 关键词高亮处理

#### 12.2 API Routes

**文件：**
```
src/app/api/search/
└── route.ts
```

**任务：**
- `GET /api/search?keyword=xxx` - 搜索文章

---

### M13: 文件上传模块

#### 13.1 Service 层

**文件：**
```
src/server/features/upload/
├── upload.service.ts
└── index.ts
```

**任务：**
- `uploadImage(file, type)` - 上传图片
  - 支持格式：PNG, JPG, JPEG, GIF, WebP
  - 大小限制：10MB
  - 自动压缩：质量 80%
  - 重命名文件

#### 13.2 API Routes

**文件：**
```
src/app/api/admin/upload/
└── route.ts
```

**任务：**
- `POST /api/admin/upload/image` - 上传图片

---

### M14: 缓存与限流

#### 14.1 Redis 缓存

**文件：**
```
src/server/cache/
└── index.ts
```

**任务：**
- 分类/标签列表缓存 (1小时)
- 首页文章列表缓存 (10分钟)
- 热门文章缓存 (10分钟)

#### 14.2 限流

**任务：**
- 评论限流：1分钟1条/IP
- 登录限流：5次失败/15分钟
- 搜索限流：10次/分钟/IP

#### 14.3 计数同步

**任务：**
- 阅读量 Redis 计数定期同步 MySQL (每5分钟)
- 点赞数 Redis 计数定期同步 MySQL (每小时)

---

### M15: 审计日志记录

#### 15.1 自动记录

**任务：**
- 登录/登出
- 创建/更新/删除文章
- 发布/归档/恢复文章
- 审核/删除评论
- 更新设置

---

## 三、API 清单汇总

### 前台 API

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/posts` | 获取文章列表 | ✅ 已实现 |
| GET | `/api/posts/[id]` | 获取文章详情 | ✅ 已实现 |
| GET | `/api/posts/trending` | 热门文章 | ⬜ 待实现 |
| GET | `/api/posts/heatmap` | 创作热力图 | ⬜ 待实现 |
| POST | `/api/posts/[id]/like` | 点赞 | ⬜ 待实现 |
| POST | `/api/posts/[id]/view` | 增加浏览量 | ⬜ 待实现 |
| GET | `/api/comments` | 获取评论列表 | ✅ 已实现 |
| POST | `/api/comments` | 提交评论 | ✅ 已实现 |
| GET | `/api/categories` | 获取分类列表 | ✅ 已实现 |
| GET | `/api/categories/[slug]` | 获取分类详情 | ⬜ 待实现 |
| GET | `/api/tags` | 获取标签列表 | ✅ 已实现 |
| GET | `/api/search` | 搜索文章 | ⬜ 待实现 |
| GET | `/api/captcha` | 获取验证码 | ⬜ 待实现 |
| GET | `/api/stats` | 统计数据 | ✅ 已实现 |

### 后台 API

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录 | ⬜ 待实现 |
| GET | `/api/auth/me` | 当前用户 | ⬜ 待实现 |
| POST | `/api/auth/logout` | 登出 | ⬜ 待实现 |
| GET | `/api/admin/posts` | 文章列表 | ⬜ 待实现 |
| POST | `/api/admin/posts` | 创建文章 | ⬜ 待实现 |
| PUT | `/api/admin/posts/[id]` | 更新文章 | ⬜ 待实现 |
| DELETE | `/api/admin/posts/[id]` | 删除文章 | ⬜ 待实现 |
| POST | `/api/admin/posts/[id]/publish` | 发布文章 | ⬜ 待实现 |
| POST | `/api/admin/posts/[id]/restore` | 恢复文章 | ⬜ 待实现 |
| POST | `/api/admin/posts/batch-delete` | 批量删除 | ⬜ 待实现 |
| GET | `/api/admin/comments` | 评论列表 | ⬜ 待实现 |
| POST | `/api/admin/comments/[id]/review` | 审核评论 | ⬜ 待实现 |
| POST | `/api/admin/comments/batch-review` | 批量审核 | ⬜ 待实现 |
| DELETE | `/api/admin/comments/[id]` | 删除评论 | ⬜ 待实现 |
| GET | `/api/admin/categories` | 分类列表 | ✅ 已实现 |
| POST | `/api/admin/categories` | 创建分类 | ✅ 已实现 |
| PUT | `/api/admin/categories/[id]` | 更新分类 | ✅ 已实现 |
| DELETE | `/api/admin/categories/[id]` | 删除分类 | ✅ 已实现 |
| GET | `/api/admin/tags` | 标签列表 | ✅ 已实现 |
| POST | `/api/admin/tags` | 创建标签 | ✅ 已实现 |
| PUT | `/api/admin/tags/[id]` | 更新标签 | ✅ 已实现 |
| DELETE | `/api/admin/tags/[id]` | 删除标签 | ✅ 已实现 |
| GET | `/api/admin/sensitive-words` | 敏感词列表 | ⬜ 待实现 |
| POST | `/api/admin/sensitive-words` | 创建敏感词 | ⬜ 待实现 |
| DELETE | `/api/admin/sensitive-words/[id]` | 删除敏感词 | ⬜ 待实现 |
| POST | `/api/admin/sensitive-words/import` | 导入敏感词 | ⬜ 待实现 |
| GET | `/api/admin/settings` | 获取设置 | ⬜ 待实现 |
| PUT | `/api/admin/settings` | 更新设置 | ⬜ 待实现 |
| GET | `/api/admin/audit-logs` | 审计日志 | ⬜ 待实现 |
| POST | `/api/admin/upload/image` | 上传图片 | ⬜ 待实现 |

---

## 四、验收标准

- [ ] 所有 API 遵循统一响应格式
- [ ] 所有输入经过 Zod 验证
- [ ] 敏感操作记录审计日志
- [ ] Redis 缓存正常工作
- [ ] 限流功能正常
- [ ] API 响应时间 P95 < 500ms
- [ ] 错误信息对用户友好

---

## 五、技术债务

- [ ] RSS 订阅 `/rss.xml`
- [ ] Webhook 回调
- [ ] 定时任务 (数据同步、清理)
- [ ] 数据库迁移脚本
- [ ] 数据种子脚本
