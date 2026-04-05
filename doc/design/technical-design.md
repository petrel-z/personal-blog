# 个人博客系统 — 技术架构设计文档

版本：v1.1
日期：2026-03-18
状态：已更新
更新内容：纠正数据库设计、补充缓存策略、完善性能优化和 SEO 方案

---

## 1. 项目概述

本项目旨在开发一个基于现代 Web 技术栈的高性能个人博客系统。系统分为 **前台展示端（Visitor Side）** 和 **后台管理端（Admin Panel）** 两部分。前台主要负责文章展示、搜索、互动（评论/点赞）及 SEO 优化；后台负责文章的全生命周期管理、数据统计及系统配置。

---

## 2. 技术选型 (Tech Stack)

### 2.1 核心框架

- **Framework**: Next.js 14+ (App Router)
  - 选择理由：React 生态最成熟的全栈框架，内置 SSR/SSG 支持 SEO，Server Actions 简化后端逻辑，路由系统强大。
- **Language**: TypeScript
  - 选择理由：类型安全，提高代码可维护性和开发效率。

### 2.2 前端技术栈

- **UI Component Library**: Shadcn/ui
  - 选择理由：基于 Tailwind CSS，高度可定制，现代化设计风格，适合前后台统一视觉。
- **Styling**: Tailwind CSS
  - 选择理由：Utility-first CSS 框架，开发速度快，响应式设计便捷。
- **State Management**: Zustand
  - 选择理由：轻量级状态管理，用于处理全局状态（如用户登录态、全局主题配置等）。
- **Markdown Rendering**:
  - `react-markdown` / `remark-gfm` / `rehype-highlight` / `rehype-slug` / `rehype-sanitize`
  - 选择理由：灵活的 Markdown 解析与渲染，支持代码高亮、表格、自动生成目录 ID，内置 XSS 过滤。
- **Icons**: Lucide React
  - 选择理由：Shadcn/ui 默认图标库，风格统一。
- **Theme**: next-themes
  - 选择理由：完美支持深色/浅色模式切换及持久化。

### 2.3 后端技术栈

- **Runtime**: Node.js (Next.js 内置)
- **Database**: MySQL 8.0+
  - 选择理由：成熟稳定，关系型数据库标准，适合结构化数据存储。
- **ORM**: Prisma
  - 选择理由：优秀的 TypeScript 支持，自动生成类型，Schema 定义清晰，Migration 管理方便。
- **Authentication**: Auth.js (NextAuth.js v5)
  - 选择理由：Next.js 生态标准认证库，支持 Credentials（账号密码）及 OAuth，Session 管理完善。
- **Validation**: Zod
  - 选择理由：Schema 声明式验证，与 TypeScript 结合紧密，用于 API 输入验证及表单验证。
- **Cache**: Redis
  - 选择理由：高性能内存数据库，用于缓存热点数据、会话存储、限流计数。

### 2.4 开发与部署

- **Package Manager**: pnpm
- **Linting/Formatting**: ESLint, Prettier
- **Version Control**: Git
- **Deployment**: Docker / Vercel (数据库需独立部署或使用云数据库)

---

## 3. 系统架构设计

### 3.1 总体架构

采用 **Next.js 全栈架构（Monolithic）**，前后端代码同仓库管理。

```
Client[浏览器 (Visitor / Admin)] -->|HTTPS| CDN[CDN / Edge]
CDN -->|Request| NextServer[Next.js Server]

subgraph Next.js App
    NextServer -->|Server Components| RSC[React Server Components]
    NextServer -->|API Routes / Server Actions| API[Backend Logic]
    API -->|ORM| Prisma[Prisma Client]
    API -->|Auth| NextAuth[Auth.js]
    API -->|Cache| Redis[Redis Cache]
end

subgraph Data Layer
    Prisma -->|TCP/IP| MySQL[(MySQL Database)]
    Redis[(Redis Cache)]
end
```

### 3.2 目录结构规范

采用 **Feature-based 架构（功能模块化）**，按业务领域组织代码，提升内聚性和可维护性。

```
/
├── prisma/                         # 数据库 Schema 和迁移
│   ├── schema.prisma
│   └── migrations/
│
├── public/                         # 静态资源
│   ├── images/
│   └── fonts/
│
├── src/
│   │
│   ├── app/                        # Next.js App Router (页面入口 + 路由)
│   │   │
│   │   ├── (public)/               # 前台路由组 (访客端)
│   │   │   ├── _components/        # 前台专用组件
│   │   │   ├── layout.tsx          # 前台布局
│   │   │   ├── page.tsx            # 首页
│   │   │   ├── post/[slug]/        # 文章详情
│   │   │   ├── category/[slug]/    # 分类列表
│   │   │   ├── search/             # 搜索页
│   │   │   ├── trending/           # 热度排行榜
│   │   │   ├── archive/            # 创作记录
│   │   │   └── about/              # 关于我
│   │   │
│   │   ├── (admin)/                # 后台路由组 (管理端)
│   │   │   ├── _components/        # 后台专用组件
│   │   │   ├── layout.tsx          # 后台布局
│   │   │   ├── login/              # 登录页
│   │   │   └── admin/              # 后台功能页
│   │   │       ├── dashboard/      # 仪表盘
│   │   │       ├── posts/          # 文章管理
│   │   │       ├── comments/       # 评论管理
│   │   │       └── settings/       # 系统设置
│   │   │
│   │   ├── api/                    # RESTful API Routes
│   │   │   ├── webhooks/           # 第三方回调
│   │   │   ├── cron/               # 定时任务
│   │   │   └── rss.xml/            # RSS 订阅
│   │   │
│   │   ├── layout.tsx              # 根布局
│   │   ├── globals.css             # 全局样式
│   │   └── not-found.tsx           # 404 页面
│   │
│   ├── components/                 # 全局公共组件
│   │   ├── ui/                     # Shadcn/ui 基础组件
│   │   └── shared/                 # 跨前后台的业务组件
│   │
│   ├── server/                     # 后端核心逻辑
│   │   │
│   │   ├── features/               # 按业务功能模块组织
│   │   │   ├── post/               # 文章模块
│   │   │   ├── comment/            # 评论模块
│   │   │   ├── auth/               # 认证模块
│   │   │   └── stats/              # 统计模块
│   │   │
│   │   ├── db/                     # 数据库连接
│   │   ├── cache/                  # 缓存服务
│   │   └── logger/                 # 日志系统
│   │
│   ├── client/                     # 前端核心逻辑
│   │   ├── hooks/                  # 自定义 React Hooks
│   │   └── stores/                 # 全局状态管理
│   │
│   └── shared/                     # 前后端共享代码
│       ├── constants/              # 常量定义
│       ├── types/                  # TypeScript 类型定义
│       ├── validations/            # Zod Schema 验证
│       ├── utils/                  # 通用工具函数
│       └── config/                 # 应用配置
│
├── auth.ts                         # NextAuth 配置
├── middleware.ts                   # Next.js 中间件
├── next.config.js                  # Next.js 配置
├── tailwind.config.ts              # Tailwind 配置
└── tsconfig.json                   # TypeScript 配置
```

### 3.3 前后台隔离与路由设计

Next.js 允许在同一个项目中通过 **Route Groups** 实现逻辑和视觉的完全隔离。

- **前台 `(public)`**:
  - 使用独立的 `layout.tsx`，包含对公众展示的 Header 和 Footer。
  - 样式风格：阅读友好，宽屏适配，SEO 优化。
  - 访问路径：`/`, `/post/xxx`。
- **后台 `(admin)`**:
  - 使用独立的 `layout.tsx`，包含 Sidebar 侧边栏和管理顶栏。
  - 集成 **Middleware**：所有 `/admin/*` 路径下的请求都会经过中间件检查 Session，未登录自动跳转 `/login`。
  - 样式风格：密集信息展示，操作友好，类似 SaaS 管理后台。
  - 访问路径：`/admin`, `/admin/posts`。

---

## 4. 数据库设计 (Database Design)

### 4.1 ER 图核心实体

主要包含：用户 (User)、角色 (Role)、权限 (Permission)、文章 (Post)、分类 (Category)、标签 (Tag)、评论 (Comment)、审计日志 (AuditLog)、敏感词 (SensitiveWord)、系统配置 (Settings)。

### 4.2 Schema 定义

```prisma
// prisma/schema.prisma

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ============================================
// RBAC 权限模型
// ============================================

// 用户表
model User {
  id        String   @id @default(cuid()) // 用户的唯一标识符
  name      String?                      // 用户的昵称或姓名
  email     String   @unique              // 用户的电子邮件地址，必须唯一
  password  String   // bcrypt 加密存储   // 用户的密码，经过 bcrypt 加密后存储
  image     String?                      // 用户的头像 URL
  deletedAt DateTime?                    // 软删除标记，记录用户被软删除的时间

  userRoles UserRole[] // 用户拥有的角色
  posts     Post[]     // 用户发布的文章
  auditLogs AuditLog[] // 用户相关的审计日志

  createdAt DateTime @default(now()) // 记录用户创建的时间
  updatedAt DateTime @updatedAt     // 记录用户最后更新的时间

  @@index([email]) // 为 email 字段创建索引，优化查询性能
}

// 角色表
model Role {
  id          String   @id @default(cuid()) // 角色的唯一标识符
  name        String   @unique              // 角色的名称，必须唯一 (admin, editor, reviewer)
  description String?                      // 角色的描述
  userRoles   UserRole[]                   // 拥有该角色的用户
  rolePermissions RolePermission[]         // 该角色拥有的权限

  createdAt DateTime @default(now()) // 记录角色创建的时间
  updatedAt DateTime @updatedAt     // 记录角色最后更新的时间
}

// 权限表
model Permission {
  id          String   @id @default(cuid()) // 权限的唯一标识符
  code        String   @unique              // 权限的代码，必须唯一 (post:create, post:update, comment:approve)
  description String?                      // 权限的描述
  rolePermissions RolePermission[]         // 拥有该权限的角色

  createdAt DateTime @default(now()) // 记录权限创建的时间
  updatedAt DateTime @updatedAt     // 记录权限最后更新的时间
}

// 用户 - 角色多对多关联表
model UserRole {
  userId String // 用户的 ID，作为外键关联到 User 表的 id 字段
  roleId String // 角色的 ID，作为外键关联到 Role 表的 id 字段

  user User @relation(fields: [userId], references: [id], onDelete: Cascade) // 与 User 模型的关联，当用户删除时，此关联记录也会被删除
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade) // 与 Role 模型的关联，当角色删除时，此关联记录也会被删除

  assignedAt DateTime @default(now()) // 记录角色分配给用户的时间

  @@id([userId, roleId]) // 定义 userId 和 roleId 的组合作为复合主键
}

// 角色 - 权限多对多关联表
model RolePermission {
  roleId       String // 角色的 ID，作为外键关联到 Role 表的 id 字段
  permissionId String // 权限的 ID，作为外键关联到 Permission 表的 id 字段

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)       // 与 Role 模型的关联，当角色删除时，此关联记录也会被删除
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade) // 与 Permission 模型的关联，当权限删除时，此关联记录也会被删除

  @@id([roleId, permissionId]) // 定义 roleId 和 permissionId 的组合作为复合主键
}

// ============================================
// 文章模块
// ============================================

// 文章状态枚举
enum PostStatus {
  DRAFT      // 草稿
  PUBLISHED  // 已发布
  ARCHIVED   // 已归档
  DELETED    // 已删除（软删除标记）
}

// 文章表
model Post {
  id          String     @id @default(cuid()) // 文章的唯一标识符
  title       String     // 标题 (1-200 字符)
  slug        String     @unique              // URL 标识符，必须唯一
  content     String     @db.LongText         // Markdown 内容
  summary     String?    @db.Text             // 文章概述
  coverImage  String?                      // 封面图 URL
  status      PostStatus @default(DRAFT)    // 文章状态 (草稿, 已发布, 已归档, 已删除)

  // 统计字段（实际计数通过 Redis，定期同步）
  viewCount   Int        @default(0)        // 阅读计数
  likeCount   Int        @default(0)        // 点赞计数
  commentCount Int       @default(0)        // 评论计数

  // SEO 字段
  seoTitle    String?                      // 自定义 SEO 标题
  seoDesc     String?                      // 自定义 SEO 描述
  keywords    String?    @db.Text          // 关键词，逗号分隔

  // 阅读时间估算（字数 / 300）
  readingTime Int?                         // 阅读时间估算

  // 置顶标记
  isPinned    Boolean    @default(false)   // 是否置顶

  authorId    String                       // 作者 ID
  author      User       @relation(fields: [authorId], references: [id]) // 文章作者

  // 分类：单分类（一个文章只能属于一个分类）
  categoryId  String?                      // 分类 ID
  category    Category?  @relation(fields: [categoryId], references: [id]) // 文章所属分类

  // 标签：多标签
  tags        Tag[]                        // 文章标签

  comments    Comment[]                    // 文章评论

  // 时间字段
  publishedAt DateTime?                    // 发布时间
  deletedAt   DateTime?                    // 软删除时间

  createdAt   DateTime   @default(now())  // 创建时间
  updatedAt   DateTime   @updatedAt       // 更新时间

  // 索引优化
  @@index([slug])                           // 优化通过 slug 查询文章的性能
  @@index([status, publishedAt])            // 优化首页查询：已发布 + 时间排序
  @@index([categoryId])                     // 优化分类页查询
  @@index([authorId])                       // 优化作者文章列表查询
  @@index([viewCount])                      // 优化热度排行查询
  @@index([isPinned, publishedAt])          // 优化置顶文章优先显示
  @@index([deletedAt])                      // 优化回收站查询
}

// 分类表（单分类，文章只能属于一个分类）
model Category {
  id          String   @id @default(cuid()) // 分类的唯一标识符
  name        String   @unique              // 分类名称，必须唯一
  slug        String   @unique              // URL 标识符，必须唯一
  description String?  @db.Text             // 分类描述
  postCount   Int      @default(0)          // 文章数量统计（定期同步）
  deletedAt   DateTime?                    // 软删除标记

  posts       Post[]                       // 该分类下的文章

  createdAt DateTime @default(now()) // 记录分类创建的时间
  updatedAt DateTime @updatedAt     // 记录分类最后更新的时间

  @@index([slug]) // 为 slug 字段创建索引，优化查询性能
}

// 标签表（多标签）
model Tag {
  id        String   @id @default(cuid()) // 标签的唯一标识符
  name      String   @unique              // 标签名称，必须唯一
  slug      String   @unique              // URL 标识符，必须唯一
  postCount Int      @default(0)          // 文章数量统计
  deletedAt DateTime?                    // 软删除标记

  posts     Post[]                       // 拥有该标签的文章

  createdAt DateTime @default(now()) // 记录标签创建的时间
  updatedAt DateTime @updatedAt     // 记录标签最后更新的时间

  @@index([slug]) // 为 slug 字段创建索引，优化查询性能
}

// ============================================
// 评论模块
// ============================================

// 评论状态枚举
enum CommentStatus {
  PENDING   // 待审核
  APPROVED  // 已通过
  REJECTED  // 已拒绝
}

// 评论表
model Comment {
  id        String        @id @default(cuid()) // 评论的唯一标识符
  content   String        @db.Text             // 评论内容 (1-500 字符)
  nickname  String        // 昵称 (1-20 字符)
  email     String?       // 邮箱（用于 Gravatar）
  website   String?       // 个人网站
  avatar    String?       // 头像 URL（优先使用 Gravatar）
  ip        String?       // IP 地址（用于防刷，存储时脱敏）
  userAgent String?       // User-Agent
  status    CommentStatus @default(PENDING)    // 评论状态 (待审核, 已通过, 已拒绝)

  // 点赞数（可选功能）
  likeCount Int           @default(0)          // 点赞数

  postId    String                             // 评论所属文章的 ID
  post      Post          @relation(fields: [postId], references: [id], onDelete: Cascade) // 评论所属文章

  // 一级回复（parentId 指向父评论）
  parentId  String?                            // 父评论的 ID
  parent    Comment?      @relation("CommentReplies", fields: [parentId], references: [id]) // 父评论
  children  Comment[]     @relation("CommentReplies")                                      // 子评论

  deletedAt DateTime?                          // 软删除时间

  createdAt DateTime      @default(now())    // 创建时间
  updatedAt DateTime      @updatedAt         // 更新时间

  // 索引优化
  @@index([postId, status])         // 优化文章评论列表（按状态筛选）
  @@index([postId, createdAt])      // 优化文章评论时间线
  @@index([status, createdAt])      // 优化后台审核列表
  @@index([parentId])               // 优化子评论查询
}

// ============================================
// 敏感词管理
// ============================================

model SensitiveWord {
  id        String   @id @default(cuid()) // 敏感词的唯一标识符
  word      String   @unique              // 敏感词
  category  String?                      // 分类（如：政治、色情、广告）
  isActive  Boolean  @default(true)      // 是否启用
  createdAt DateTime @default(now()) // 记录敏感词创建的时间
  updatedAt DateTime @updatedAt     // 记录敏感词最后更新的时间

  @@index([category]) // 优化按分类查询敏感词的性能
}

// ============================================
// 系统配置
// ============================================

model Settings {
  id        String   @id @default(cuid()) // 配置项的唯一标识符
  key       String   @unique              // 配置键，必须唯一
  value     String   @db.Text             // 配置值（JSON 格式）
  category  String?                      // 分类（如：site, seo, comment）
  updatedAt DateTime @updatedAt         // 记录配置项最后更新的时间

  @@index([category]) // 优化按分类查询配置项的性能
}

// ============================================
// 审计日志
// ============================================

model AuditLog {
  id        String   @id @default(cuid()) // 审计日志的唯一标识符
  userId    String?                      // 执行操作的用户 ID
  action    String                       // 执行的操作 (post.create, post.delete, comment.approve)
  target    String?                      // 目标资源 ID
  details   String?  @db.Text             // JSON 格式的详细信息
  ipAddress String?                      // 操作时的 IP 地址
  userAgent String?                      // 操作时的 User-Agent

  user      User?    @relation(fields: [userId], references: [id]) // 执行操作的用户

  createdAt DateTime @default(now()) // 记录审计日志创建的时间

  @@index([userId])    // 优化按用户查询审计日志的性能
  @@index([action])    // 优化按操作类型查询审计日志的性能
  @@index([createdAt]) // 优化按时间查询审计日志的性能
}
```

### 4.3 权限设计说明

#### **RBAC 权限模型**

```
User (用户)
  ↓ N:N
Role (角色：admin, editor, reviewer)
  ↓ N:N
Permission (权限：post:create, comment:approve)
```

**角色权限示例：**

| 角色         | 权限                                                     |
| ------------ | -------------------------------------------------------- |
| **admin**    | 全部权限                                                 |
| **editor**   | `post:create`, `post:update`, `post:delete` (自己的文章) |
| **reviewer** | `comment:approve`, `comment:reject`                      |

**权限代码设计：**

```
post:create      # 创建文章
post:update      # 更新文章
post:delete      # 删除文章
post:publish     # 发布文章
comment:approve  # 审核通过评论
comment:reject   # 拒绝评论
comment:delete   # 删除评论
dashboard:view   # 查看仪表盘
settings:update  # 修改系统设置
```

---

## 5. 缓存策略设计

### 5.1 缓存架构

采用 **三级缓存架构**：

```
浏览器缓存 (LocalStorage/SessionStorage)
    ↓
Redis 缓存 (热点数据、会话、计数)
    ↓
MySQL 数据库 (持久化存储)
```

### 5.2 Redis 缓存策略

#### **1. 会话存储 (Session)**

- **用途**: 存储用户登录会话
- **Key 格式**: `session:{sessionId}`
- **过期时间**: 24 小时
- **数据结构**: Hash

#### **2. 文章阅读计数**

- **用途**: 防止频繁写入数据库，实现防刷
- **Key 格式**: `post:view:{postId}:{ipHash}`
- **过期时间**: 10 分钟
- **数据结构**: String
- **同步策略**:
  - 每次访问先检查 Redis，10 分钟内同一 IP 不重复计数
  - 计数累加到 `post:views:{postId}` (文章总阅读量)
  - 每 5 分钟批量同步到 MySQL

#### **3. 文章点赞计数**

- **用途**: 防止刷赞，减少数据库压力
- **Key 格式**: `post:like:{postId}:{ipHash}`
- **过期时间**: 永久（已点赞标记）
- **数据结构**: String
- **同步策略**: 实时写入 Redis，每小时同步到 MySQL

#### **4. 评论频率限制**

- **用途**: 防止评论 spam
- **Key 格式**: `comment:rate:{ipHash}`
- **过期时间**: 1 分钟
- **数据结构**: String (计数器)
- **限制规则**: 1 分钟内最多 1 条评论

#### **5. 登录失败次数限制**

- **用途**: 防止暴力破解
- **Key 格式**: `login:fail:{email}`
- **过期时间**: 15 分钟
- **数据结构**: String (计数器)
- **限制规则**: 5 次失败后锁定 15 分钟

#### **6. 热点文章缓存**

- **用途**: 缓存首页、热门列表
- **Key 格式**:
  - `cache:posts:home:{page}:{pageSize}`
  - `cache:posts:trending:{timeframe}`
- **过期时间**: 10 分钟
- **数据结构**: JSON String
- **失效策略**: 文章发布/更新/删除时主动失效

#### **7. 分类和标签缓存**

- **用途**: 缓存分类列表、标签列表
- **Key 格式**:
  - `cache:categories`
  - `cache:tags`
- **过期时间**: 1 小时
- **失效策略**: 分类/标签变更时主动失效

### 5.3 缓存一致性策略

#### **主动失效**

当数据变更时，主动删除相关缓存：

```
文章发布/更新/删除 → 失效：
  - cache:posts:home:*
  - cache:posts:trending:*
  - cache:category:{categoryId}
  - cache:post:detail:{postId}
```

#### **定时同步**

Redis 计数定期同步到 MySQL：

```
每 5 分钟执行：
  - 文章阅读量：post:views:{postId} → Post.viewCount
  - 文章点赞数：post:likes:{postId} → Post.likeCount
```

### 5.4 前端缓存策略

#### **浏览器本地存储**

- **主题偏好**: `localStorage.theme`
- **语言偏好**: `localStorage.lang`
- **搜索历史**: `localStorage.searchHistory` (最多 10 条)
- **草稿内容**: `localStorage:draft:{postId}` (退出编辑时清理)

#### **HTTP 缓存**

- **静态资源**: CDN 缓存，max-age=31536000 (1 年)
- **API 响应**: 根据数据类型设置不同缓存策略
- **页面缓存**: SSG 生成的页面启用 HTTP 缓存

---

## 6. 性能优化方案

### 6.1 前端性能优化

#### **1. 代码分割**

- **按路由分割**: 每个路由独立打包，按需加载
- **组件懒加载**: 大型组件（如 Markdown 编辑器）使用动态导入
- **第三方库分离**: node_modules 单独打包，利用长期缓存

#### **2. 图片优化**

- **格式优化**:
  - 上传时自动转换为 WebP 格式（兼容浏览器回退到 JPG/PNG）
  - 质量压缩至 80%
- **尺寸优化**:
  - 生成多尺寸缩略图（小图用于列表，大图用于详情）
  - 响应式图片（srcset 根据设备选择合适尺寸）
- **懒加载**:
  - 使用 Intersection Observer API 实现图片懒加载
  - 占位图（低质量预览图或纯色背景）
- **CDN 加速**: 所有图片通过 CDN 分发

#### **3. 字体优化**

- **字体子集**: 仅加载使用到的字符
- **字体交换**: 使用 font-display: swap 避免 FOIT
- **预加载**: 关键字体使用 `<link rel="preload">`

#### **4. CSS 优化**

- **关键 CSS 内联**: 首屏关键样式内联到 HTML
- **CSS 压缩**: 生产环境启用 CSS 压缩
- **Tree Shaking**: 仅使用用到的 Tailwind 样式

#### **5. JavaScript 优化**

- **Tree Shaking**: 移除未使用的代码
- **压缩混淆**: 生产环境启用代码压缩
- **异步加载**: 非关键 JS 异步加载

#### **6. 渲染优化**

- **SSR/SSG**: 首屏内容服务端渲染或静态生成
- **流式渲染**: 使用 React Suspense 实现流式 SSR
- **骨架屏**: 加载时显示骨架屏提升感知性能

### 6.2 后端性能优化

#### **1. 数据库查询优化**

- **索引优化**: 根据查询模式建立合适索引
- **避免 N+1**: 使用 Prisma 的 include 预加载关联数据
- **分页优化**: 使用游标分页替代 offset 分页（大数据量时）
- **慢查询监控**: 记录执行时间超过 100ms 的查询

#### **2. 接口响应优化**

- **字段裁剪**: 仅返回需要的字段
- **数据压缩**: 启用 Gzip/Brotli 压缩
- **响应缓存**: 对不变的数据启用缓存

#### **3. 并发处理**

- **异步任务**: 耗时操作（如发送邮件）异步执行
- **批量操作**: 批量写入合并为一次数据库操作
- **连接池**: 数据库连接池复用连接

### 6.3 性能监控

#### **前端监控指标**

- **LCP (Largest Contentful Paint)**: 目标 < 2.5s
- **FID (First Input Delay)**: 目标 < 100ms
- **CLS (Cumulative Layout Shift)**: 目标 < 0.1
- **FCP (First Contentful Paint)**: 目标 < 1.8s

#### **后端监控指标**

- **接口响应时间**: P95 < 500ms
- **错误率**: < 0.1%
- **数据库查询时间**: P95 < 100ms
- **缓存命中率**: > 80%

---

## 7. SEO 实现方案

### 7.1 SEO 核心策略

#### **1. 服务端渲染 (SSR)**

- 所有前台页面使用 SSR 或 SSG
- 确保搜索引擎爬虫能获取完整 HTML 内容
- 文章详情页使用 ISR（增量静态再生）

#### **2. 元数据管理**

每页动态生成以下元数据：

```
<title>: 文章标题 | 博客名称
<meta name="description">: 文章摘要或博客描述
<meta name="keywords">: 文章关键词
<link rel="canonical">: 规范 URL 防止重复内容
<meta property="og:title">: Open Graph 标题
<meta property="og:description">: Open Graph 描述
<meta property="og:image">: Open Graph 图片
<meta property="og:url">: Open Graph URL
<meta name="twitter:card">: Twitter Card 类型
```

#### **3. 结构化数据 (JSON-LD)**

注入以下结构化数据：

- **Article**: 文章类型、作者、发布时间、修改时间
- **BreadcrumbList**: 面包屑导航
- **Organization**: 组织信息
- **Person**: 作者信息

### 7.2 SEO 实施步骤

#### **步骤 1: Sitemap 生成**

- **内容**: 包含所有已发布文章的 URL
- **格式**: XML 格式，符合 Sitemap 协议
- **更新频率**:
  - 自动更新：文章发布/更新时触发
  - 定时更新：每日凌晨重建
- **提交**: 自动提交到 Google Search Console

#### **步骤 2: Robots.txt 配置**

- 允许抓取：前台所有页面
- 禁止抓取：后台管理页面、API 接口
- 指定 Sitemap 位置

#### **步骤 3: URL 规范化**

- **语义化 URL**: `/post/article-slug` 而非 `/post?id=123`
- **小写字母**: 所有 URL 使用小写
- **连字符分隔**: 单词间使用 `-` 分隔
- **去除停用词**: slug 中去除冠词、介词等

#### **步骤 4: 内部链接优化**

- **面包屑导航**: 清晰的内容层级
- **相关文章**: 文章底部推荐相关文章
- **分类导航**: 分类页面互相链接
- **站内搜索**: 提供搜索功能帮助发现内容

#### **步骤 5: 移动端优化**

- **响应式设计**: 适配各种屏幕尺寸
- **触摸友好**: 按钮大小适合触摸操作
- **字体可读**: 移动端字体大小适中

#### **步骤 6: 页面速度优化**

- 参考性能优化方案
- 目标 Lighthouse 分数 > 90

### 7.3 SEO 检查清单

- [ ] 每个页面有唯一的 title 和 description
- [ ] 图片有 alt 属性
- [ ] 使用语义化 HTML 标签（header, main, footer, article, section）
- [ ] 标题层级正确（h1 → h2 → h3）
- [ ] 内部链接使用描述性锚文本
- [ ] 启用 HTTPS
- [ ] 网站有固定的域名（不带 www 或带 www 统一）
- [ ] 404 页面友好
- [ ] 有清晰的导航结构
- [ ] 网站加载速度快

---

## 8. 安全设计

### 8.1 认证安全

- **密码加密**: 使用 bcrypt 加密存储，成本因子 12
- **会话管理**:
  - Session ID 使用加密安全的随机数生成
  - 会话过期时间 24 小时
  - 登出时会话立即失效
- **登录保护**:
  - 5 次失败后锁定 15 分钟
  - 登录需要图片验证码

### 8.2 数据安全

- **XSS 防护**:
  - React 默认转义输出
  - Markdown 渲染使用 rehype-sanitize 过滤
  - 富文本编辑器白名单过滤
- **CSRF 防护**:
  - NextAuth 内置 CSRF Token
  - 敏感操作需要 CSRF 验证
- **SQL 注入防护**:
  - 使用 Prisma ORM 参数化查询
  - 禁止拼接 SQL

### 8.3 接口安全

- **Rate Limiting**:
  - 评论接口：1 分钟 1 条/IP
  - 登录接口：5 次失败/15 分钟
  - 搜索接口：10 次/分钟/IP
- **输入验证**:
  - 使用 Zod 验证所有输入
  - 严格类型转换

### 8.4 内容安全

- **敏感词过滤**:
  - 评论发布时检查敏感词
  - 命中敏感词自动标记待审核
- **文件上传安全**:
  - 限制文件类型（白名单）
  - 限制文件大小（10MB）
  - 重命名上传文件

---

## 9. 部署流程 (DevOps)

### 9.1 构建与运行原理

Next.js 是一个**全栈框架**，构建产物同时包含前端静态资源和后端服务器逻辑。

- **Build 阶段**: `next build` 执行：
  - 编译 React 组件为静态 HTML (SSG) 或服务器端组件 (RSC)
  - 编译 TypeScript 后端逻辑 (API Routes, Server Actions)
  - 打包生成 `.next` 文件夹
- **Run 阶段**: `next start` 启动 Node.js 服务器：
  - 监听端口（默认 3000）
  - 处理页面请求和 API 调用
  - 访问数据库

### 9.2 部署架构

```
用户 --> CDN (静态资源) --> Nginx (反向代理) --> Next.js (Node.js 应用)
                                                      ↓
                                                 MySQL + Redis
```

### 9.3 部署步骤

1. **环境准备**:
   - 服务器（Linux）安装 Node.js 18+、PM2、MySQL 8.0+、Redis

2. **构建**:

   ```bash
   pnpm install
   pnpm build
   ```

3. **数据库迁移**:

   ```bash
   npx prisma migrate deploy
   ```

4. **启动服务**:

   ```bash
   pm2 start npm --name "blog" -- start -- -p 3000
   ```

5. **Nginx 反向代理**: 配置域名转发到 localhost:3000

### 9.4 环境变量

需要配置以下环境变量：

```
# 数据库
DATABASE_URL=mysql://user:password@localhost:3306/blog

# Redis
REDIS_URL=redis://localhost:6379

# 认证
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.com

# 其他
GEMINI_API_KEY=xxx (可选，用于 AI 摘要)
```

---

## 10. 监控与日志

### 10.1 应用监控

- **错误监控**: 记录未捕获的异常和错误
- **性能监控**: 记录接口响应时间
- **业务监控**: 记录关键业务操作（发布、删除、审核）

### 10.2 日志系统

- **访问日志**: 记录所有 HTTP 请求
- **错误日志**: 记录所有错误详情
- **审计日志**: 记录管理员操作

---

## 11. 附录：关键决策说明

### 11.1 为什么使用单分类而非多分类？

- **简化导航**: 用户更容易理解内容组织
- **避免重复**: 一篇文章不会出现在多个分类
- **简化后台**: 文章编辑时只需选择一个分类

### 11.2 为什么评论只支持一级回复？

- **简化交互**: 嵌套过深会降低可读性
- **降低复杂度**: 实现和维护成本更低
- **足够使用**: 一级回复满足大部分场景

### 11.3 为什么使用 Redis 计数而非直接写库？

- **性能**: 减少数据库写操作频率
- **防刷**: 便于实现频率限制
- **准确性**: 避免并发写入导致的数据不一致

---
