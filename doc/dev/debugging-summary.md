# Bug 修复总结

## 1. 端口占用问题

**问题**：`Port 3000 is already in use`

**解决**：查找并终止占用端口的进程
```bash
lsof -i :3000
kill -9 <PID>
```

---

## 2. next-auth 版本不兼容

**问题**：`next-auth/next Request not a constructor`

**原因**：next-auth@5.0.0-beta.30 与 next@14.1.0 不兼容

**解决**：升级 Next.js 版本
```bash
pnpm add next@14.2.18 next-auth@5.0.0-beta.30
```

---

## 3. MySQL 数据库连接问题

### 数据库不存在
**问题**：`Error P1001: Can't reach database server`

**解决**：
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 密码认证失败
**问题**：`Authentication failed`

**解决**：重置 MySQL 密码并更新 `.env` 文件中的 `DATABASE_URL`

### 表不存在
**问题**：Prisma schema 与数据库不同步

**解决**：
```bash
pnpm prisma db push
```

---

## 4. 后台布局错位

**问题**：侧边栏有白色边框、用户信息被截断

**原因**：
- 主容器未使用 flex 布局
- 侧边栏高度设置不当

**解决**：修改 `src/app/(admin)/layout.tsx`
```tsx
<div className="flex min-h-screen bg-background">  // 改为 flex
  <AdminSidebar ... />
  <div className="flex-1 lg:pl-64">  // 添加 flex-1
```

修改 `src/app/(admin)/_components/AdminSidebar.tsx`
```tsx
<aside className="fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-border flex-shrink-0 ...">
```

---

## 5. 文章管理页面崩溃

**问题**：`TypeError: Cannot read properties of undefined (reading 'length')`

**原因**：API 返回数据在 `result.data` 中，但代码错误地访问 `result.total` / `result.totalPages`

**解决**：修改 `src/app/(admin)/admin/posts/page.tsx` 第33-45行
```tsx
// 错误写法
setTotal(result.total ?? 0)
setTotalPages(result.totalPages || 1)

// 正确写法
setTotal(result.data.total ?? 0)
setTotalPages(result.data.totalPages || 1)
```

---

## 6. 登录验证码功能（临时禁用）

**问题**：验证码功能导致登录流程复杂

**解决**：注释掉 `src/app/(admin)/_components/LoginForm.tsx` 中的验证码验证代码，并将 `loginSchema` 中 captcha 改为 optional

---

## 7. API 响应格式不一致

### 问题描述
部分 API（如 `/api/categories`）返回的 `data` 是数组直接返回，但前端代码期望 `{ items: [...] }` 格式。

### API 实际返回格式
```json
// categories, tags 等列表接口
{
  "code": 2000,
  "data": [{ "id": "1", "name": "分类1" }, ...]
}

// posts 等分页接口
{
  "code": 2000,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

### 解决方案
修改前端代码，兼容两种格式：
```typescript
setCategories(Array.isArray(result.data) ? result.data : result.data.items || [])
```

### 受影响文件
- `src/app/(public)/_components/Sidebar.tsx`
- `src/app/(public)/category/[slug]/page.tsx`
- `src/app/(admin)/admin/categories/page.tsx`
- `src/app/(admin)/admin/posts/[id]/page.tsx`
- `src/app/(admin)/admin/posts/new/page.tsx`

---

## 8. 文章创建接口返回状态码不一致

### 问题描述
创建文章成功返回 `code: 2010`（CREATED），但前端只检查 `code: 2000`。

### API 状态码定义
```typescript
// src/lib/api-response.ts
SUCCESS: 2000,
CREATED: 2010,
```

### 解决方案
前端判断时同时检查两个状态码：
```typescript
if (result.code === 2000 || result.code === 2010) {
  // 成功处理
}
```

### 受影响文件
- `src/app/(admin)/admin/posts/new/page.tsx`
- `src/app/(admin)/admin/posts/[id]/page.tsx`

---

## 9. 分类页面文章查询参数错误

### 问题描述
分类页面调用文章列表接口时传递 `categorySlug`，但 API 期望 `categoryId`。

### 解决方案
先获取分类列表找到对应的 categoryId，再调用文章接口：
```typescript
const categoriesResult = await api.get('/categories')
const cat = categoriesResult.data.items.find((c) => c.slug === slug)
const postsResult = await api.get('/posts', { categoryId: cat.id })
```

### 受影响文件
- `src/app/(public)/category/[slug]/page.tsx`

---

## 10. 热力图功能增强

### 问题描述
用户需要：
1. 显示月份标签（类似 GitHub 贡献热力图）
2. 每增加一篇文章，颜色加深一个层次
3. 悬停显示年月日和文章数量

### 解决方案
- 月份标签：添加与周对齐的月份行
- 颜色深度：10 个级别（0-9 篇对应 bg-primary/0 到 bg-primary/100）
- 悬停提示：`title="${year}年${month}月${day}日：${count} 篇文章"`

### 受影响文件
- `src/app/(public)/archive/page.tsx`

---

## 11. 首页轮播图逻辑

### 问题描述
没有文章时，轮播图不显示。用户希望即使没有文章也要显示默认内容。

### 解决方案
移除 `featuredPost &&` 条件渲染，改为始终显示并使用可选链：
```tsx
<img src={featuredPost?.coverImage || 'https://picsum.photos/seed/banner/1200/600'} />
{featuredPost ? (
  <Link href={`/post/${featuredPost.slug}`}>
    <h1>{featuredPost.title}</h1>
  </Link>
) : (
  <h1>欢迎访问博客</h1>
)}
```

### 受影响文件
- `src/app/(public)/page.tsx`

---

## 12. isPinned 类型缺失

### 问题描述
`PostWithRelations` 类型中缺少 `isPinned` 字段，导致 TypeScript 报错。

### 解决方案
在类型定义中添加可选字段：
```typescript
// src/shared/types/index.ts
export interface PostWithRelations {
  // ...
  isPinned?: boolean
  // ...
}
```

### 受影响文件
- `src/shared/types/index.ts`

---

## 13. 阿里云 OSS 图片上传

### 问题描述
实现图片上传到阿里云 OSS 时遇到多个问题。

### 问题 1: Bucket 配置错误
- **错误**: `InvalidBucketName`
- **原因**: OSS_REGION 和 OSS_ENDPOINT 配置与实际 bucket 区域不符
- **解决**: 确认 bucket 所在区域，修改配置

### 问题 2: AccessKey 无权限
- **错误**: `AccessDenied - You have no right to access this object because of bucket acl.`
- **原因**: AccessKey 缺少 RAM 授权
- **解决**: 在 RAM 控制台添加权限策略
  ```json
  {
    "Effect": "Allow",
    "Action": ["oss:PutObject", "oss:GetObject"],
    "Resource": ["acs:oss:*:*:petrel-blog", "acs:oss:*:*:petrel-blog/*"]
  }
  ```

### OSS 配置示例
```bash
STORAGE_PROVIDER="oss"
OSS_ACCESS_KEY_ID="your-key-id"
OSS_ACCESS_KEY_SECRET="your-secret"
OSS_BUCKET="your-bucket"
OSS_REGION="oss-cn-beijing"
OSS_ENDPOINT="oss-cn-beijing.aliyuncs.com"
OSS_CDN_DOMAIN="https://your-cdn-domain.com"  # 可选
```

### 受影响文件
- `src/app/api/upload/route.ts` - 上传接口
- `src/shared/config/storage.ts` - 存储配置
- `.env` - 环境变量

---

## 通用经验总结

1. **API 响应格式**: 不同接口可能返回不同格式，前端需要兼容处理
2. **状态码检查**: 创建类操作返回 2010，更新/删除返回 2000
3. **类型定义**: 定期检查 shared/types 是否与数据库模型同步
4. **云存储配置**: 需要同时配置 Bucket ACL 和 RAM 权限
5. **错误日志**: 使用 `console.error` 输出完整错误信息便于排查

---

## 14. 文章详情页 URL 从 slug 改为 id

### 问题描述
文章详情页使用 slug 作为 URL，但 slug 可能不唯一，且数据库虽然有唯一索引，但万一重复会导致问题。

### 解决方案
使用文章 ID 作为 URL，更可靠：
- 移动页面路由：`/post/[slug]` → `/post/[id]`
- API 调用：`/api/posts/slug/${slug}` → `/api/posts/${id}`
- 所有文章链接：`/post/${article.slug}` → `/post/${article.id}`

### 受影响文件
- `src/app/(public)/post/[slug]/page.tsx` → `src/app/(public)/post/[id]/page.tsx`
- `src/app/(public)/page.tsx`
- `src/app/(public)/_components/ArticleCard.tsx`
- `src/app/(public)/_components/FeaturedBanner.tsx`
- `src/app/(public)/_components/RightWidgets.tsx`
- `src/app/(public)/category/[slug]/page.tsx`
- `src/app/(public)/search/page.tsx`
- `src/app/(public)/trending/page.tsx`

---

## 15. 登录页被后台布局包裹

### 问题描述
登录页位于 `(admin)` 路由组下，被 `layout.tsx` 的 AdminSidebar 和 AdminHeader 包裹，导致显示异常。

### 解决方案
将登录页移到 `(admin)` 路由组外面，成为独立的路由：
- 移动：`src/app/(admin)/login/page.tsx` → `src/app/login/page.tsx`
- 登录页使用独立的全屏布局，不再使用后台侧边栏和头部

### 受影响文件
- `src/app/login/page.tsx`（新建）
- 修复 `LoginForm` 组件的导入路径

---

## 16. 登录页 useSearchParams 需要 Suspense

### 问题描述
构建时报错：`useSearchParams() should be wrapped in a suspense boundary at page "/login"`

### 解决方案
在 `LoginPage` 中用 `Suspense` 包裹 `LoginForm` 组件：
```tsx
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

<Suspense fallback={
  <div className="flex items-center justify-center py-4">
    <Loader2 className="animate-spin text-muted-foreground" />
  </div>
}>
  <LoginForm />
</Suspense>
```

### 受影响文件
- `src/app/login/page.tsx`

---

## 17. 文章更新接口 HTTP 方法错误

### 问题描述
更新文章时报错：`Unexpected end of JSON input`，原因是前端用 `api.put()` 但后端只支持 `PATCH` 方法。

### 解决方案
将 `api.put()` 改为 `api.patch()`：
```typescript
// 错误
result = await api.put(`/posts/${id}`, data)

// 正确
result = await api.patch(`/posts/${id}`, data)
```

### 受影响文件
- `src/app/(admin)/admin/posts/[id]/page.tsx`

---

## 18. 文章更新成功后无提示且不跳转

### 问题描述
更新文章成功后没有明显的成功提示，也不返回文章列表页。

### 解决方案
1. 显示成功状态："已保存"
2. 1.5秒后自动跳转到文章列表页：
```typescript
if (result.code === 2000 || result.code === 2010) {
  setSaveStatus('saved')
  if (id === 'new' && result.data) {
    router.push(`/admin/posts/${(result.data as PostWithRelations).id}`)
  } else {
    setTimeout(() => {
      router.push('/admin/posts')
    }, 1500)
  }
}
```

### 受影响文件
- `src/app/(admin)/admin/posts/[id]/page.tsx`

---

## 19. 评论组件对接真实接口

### 问题描述
评论区组件使用硬编码的 mock 数据，没有对接真实 API。

### 解决方案
1. 评论组件接收 `postId` 参数
2. 从 `/api/comments?postId=xxx` 获取已审核评论
3. 提交评论到 `/api/comments`
4. 显示提交状态（成功/失败）

### 验证码接口适配
验证码接口返回格式特殊：ID 在响应头 `X-Captcha-Id` 中，图片是 SVG 直接返回：
```typescript
const fetchCaptcha = async () => {
  const response = await fetch('/api/captcha')
  const captchaId = response.headers.get('X-Captcha-Id') || ''
  const svg = await response.text()
  setCaptchaId(captchaId)
  setCaptchaImage(`data:image/svg+xml;base64,${btoa(svg)}`)
}
```

### 受影响文件
- `src/app/(public)/_components/CommentSection.tsx`
- `src/app/(public)/post/[id]/page.tsx`

---

## 20. 侧边栏热门文章缺少 coverImage 字段

### 问题描述
侧边栏热门文章接口返回的数据没有 `coverImage`，导致图片显示为空。

### 解决方案
在 `getTrendingPosts` 查询中添加 `coverImage` 字段：
```typescript
const posts = await prisma.post.findMany({
  where: { ... },
  select: {
    id: true,
    title: true,
    slug: true,
    viewCount: true,
    likeCount: true,
    commentCount: true,
    publishedAt: true,
    coverImage: true,  // 添加此字段
  },
})
```

### 受影响文件
- `src/server/features/stats/stats.service.ts`

---

## 21. 前端文章链接未同步更新

### 问题描述
文章详情页 URL 从 slug 改为 id 后，前端其他位置的文章链接仍在使用 slug。

### 解决方案
将所有文章链接从 `article.slug` 改为 `article.id`：
```typescript
// 修改前
href={`/post/${article.slug}`}

// 修改后
href={`/post/${article.id}`}
```

### 受影响文件
- `src/app/(public)/page.tsx`
- `src/app/(public)/_components/ArticleCard.tsx`
- `src/app/(public)/_components/FeaturedBanner.tsx`
- `src/app/(public)/_components/RightWidgets.tsx`
- `src/app/(public)/category/[slug]/page.tsx`
- `src/app/(public)/search/page.tsx`
- `src/app/(public)/trending/page.tsx`

---

## 经验总结（续）

6. **HTTP 方法匹配**: 调用 API 时确保前端使用的 HTTP 方法（GET/POST/PATCH/DELETE）与后端一致
7. **Suspense 边界**: 使用 `useSearchParams`、`useRouter` 等客户端 hooks 时，需要用 Suspense 包裹
8. **URL 设计**: 优先使用 ID 而非 slug 作为资源标识，更可靠且避免重复问题
9. **接口返回格式**: 某些接口（如验证码）可能返回非常规格式，需要适配处理
10. **成功反馈**: 操作成功后应提供明确的用户反馈，并适时跳转页面

---

## 22. 文章详情页 prev/next 逻辑错误

**问题**：发布时间为 null 时排序错误，且 prev/next 方向颠倒

**修复**：
- fallback 使用 `createdAt` 替代 `publishedAt`
- prev: `createdAt gt 当前值` + `ORDER BY createdAt ASC`
- next: `createdAt lt 当前值` + `ORDER BY createdAt DESC`

**文件**：`src/server/features/post/post.service.ts`

---

## 23. React useEffect 无限循环

**问题**：`fetchArticle` 依赖 `article` 状态，又在函数内更新 `article`，形成循环

**修复**：使用 `useRef` 判断首次加载，移除 `article` 依赖

**文件**：`src/app/(public)/post/[id]/page.tsx`

---

## 24. 分类页语法错误

**问题**：`fetchData` 箭头函数缺少闭合 `})`

**文件**：`src/app/(public)/category/[slug]/page.tsx`

---

## 25. next/image 未配置 OSS 域名

**错误**：`hostname "petrel-blog.oss-cn-beijing.aliyuncs.com" is not configured`

**修复**：在 `next.config.js` 添加 OSS 域名配置

---

## 26. XSS 安全风险

**问题**：`rehype-raw` 可能允许恶意 HTML

**修复**：添加 `rehype-sanitize` 消毒插件

---

## 27. 登录验证码被禁用

**修复**：重新启用 `LoginForm.tsx` 中的验证码验证逻辑

---

## 28. TypeScript any 类型滥用

**修复**：使用 `Prisma.PostWhereInput` 等生成类型替代 any

---

## 29. 图片使用原生 img 标签

**修复**：替换为 `next/image` 组件

---

## 30. formatDate 函数重复定义

**修复**：统一到 `src/shared/utils/index.ts`

---

## 31. API 缺少缓存策略

**修复**：stats/categories/tags API 添加 Cache-Control headers
