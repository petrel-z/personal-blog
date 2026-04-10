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

---

## 32. 文章目录导航跳转失败

**问题**：点击目录标题无法跳转到对应章节

**原因**：`parseTOC` 自定义的 slugify 函数在处理中文标题时生成不合法或重复的 ID（如空字符串、`-1`、`-2` 后缀），与 `rehype-slug` 渲染的实际 HTML ID 不匹配，导致 `document.getElementById(id)` 找不到元素

**修复**：使用 `github-slugger` 替代自定义 slugify，确保与 `rehype-slug` 生成 ID 完全一致：
```typescript
import Slugger from 'github-slugger'

function parseTOC(content: string) {
  const slugger = new Slugger()
  while ((match = headingRegex.exec(content)) !== null) {
    const id = slugger.slug(text) // 自动处理中文和重复标题
  }
}
```

**文件**：`src/app/(public)/post/[id]/page.tsx`

---

## 33. useToast 组件外调用导致无限循环

### 问题描述
文章管理页面一直疯狂调用获取文章列表接口，导致页面卡死。

### 原因分析
`useToast` hook 在 `ToastContext` 为 null 时（SSR 或组件在 Toaster 外被调用），每次都返回一个新对象：
```typescript
// 错误写法
if (!context) {
  return {
    toast: () => {},
    dismiss: () => {},
  }
}
```

这导致 `toast` 引用每次都变化，而 `fetchPosts` 依赖 `toast`，因此依赖数组不断变化，触发 useEffect 无限循环。

### 解决方案
使用稳定的单例对象，避免引用变化：
```typescript
// 模块级别创建稳定的空函数对象
const noopToast = {
  toast: () => {},
  dismiss: () => {},
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    return noopToast  // 返回稳定的单例引用
  }
  return context
}
```

### 受影响文件
- `src/components/ui/toaster.tsx`
- `src/app/(admin)/admin/posts/page.tsx`
- `src/app/(admin)/admin/tags/page.tsx`

### 经验总结
11. **React Hooks 依赖**: 任何在 useCallback/useEffect 中使用的值，都必须是稳定的引用
12. **Context 空值处理**: 返回空函数时要确保引用稳定，避免导致依赖方无限重渲染

---

## 34. 后台布局 - 侧边栏遮挡内容

**问题描述**：左侧边栏使用 `fixed` 定位，不占据文档流位置，导致右侧内容被遮挡。

**原因分析**：
- 侧边栏使用 `position: fixed`，从文档流中移除
- 内容区域没有为固定侧边栏预留空间

**解决方案**：
- 文件：`src/app/(admin)/layout.tsx`
- 为内容容器添加 `lg:ml-64` 偏移量

```tsx
<div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
```

---

## 35. 文章目录默认显示

**问题描述**：文章详情页的目录默认隐藏，用户希望默认显示。

**解决方案**：
- 文件：`src/app/(public)/post/[id]/page.tsx`
- 将 `isTOCVisible` 状态默认值从 `false` 改为 `true`

```tsx
const [isTOCVisible, setIsTOCVisible] = useState(true);
```

---

## 36. 代码块复制功能

**问题描述**：需要为 Markdown 代码块添加复制功能。

**解决方案**：
- 创建 `CodeBlock` 组件，包装 `<pre>` 元素
- 添加复制按钮，悬停时显示
- 使用 Clipboard API 实现复制

```tsx
function CodeBlock({ children, ...props }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const code = preRef.current?.textContent || "";
    await navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre ref={preRef} {...props}>{children}</pre>
      <button onClick={handleCopy}>复制</button>
    </div>
  );
}
```

---

## 37. 代码块语法高亮 - Vue/JSX 不高亮

**问题描述**：
- 使用 `rehype-highlight` 时，`vue` 和 `jsx` 代码块不显示高亮
- highlight.js 默认只支持 37 种常见语言

**原因分析**：
- highlight.js 的 common 捆绑包不包含 `vue` 语言
- `vue` 不是独立语言，而是 HTML + CSS + JS 的组合

**解决方案**：
- 文件：`src/app/(public)/post/[id]/page.tsx`
- 配置语言别名映射

```tsx
import rehypeHighlight from 'rehype-highlight';

<ReactMarkdown
  rehypePlugins={[
    rehypeSanitize,
    rehypeSlug,
    [rehypeHighlight, {
      detect: true,
      aliases: {
        vue: 'html',    // Vue 模板用 HTML 高亮
        jsx: 'javascript',
        tsx: 'typescript'
      }
    }],
  ]}
>
```

**highlight.js 默认支持的语言**：
| 语言 | 支持情况 | 解决方案 |
|------|---------|---------|
| JavaScript/TypeScript | ✅ 原生支持 | 直接使用 |
| Python/Java/C++/Go/Rust | ✅ 原生支持 | 直接使用 |
| HTML/CSS | ✅ 原生支持 | 直接使用 |
| Vue | ❌ 不支持 | 映射为 HTML |
| JSX | ❌ 不支持 | 映射为 JavaScript |

---

## 38. 评论输入框主题颜色问题

**问题描述**：浅色主题下，评论区的输入框显示深色背景色。

**原因分析**：
- 输入框使用了 `bg-sidebar-active/20`
- `sidebar-active` 在浅色主题下是暖棕色调 (#e0d7c1)
- 不适合作为输入框背景

**解决方案**：
- 文件：`src/app/(public)/_components/CommentSection.tsx`
- 浅色主题使用 `bg-background`，深色主题使用 `dark:bg-sidebar-active/10`

```tsx
<input className="bg-background dark:bg-sidebar-active/10 ..." />
<textarea className="bg-background dark:bg-sidebar-active/10 ..." />
```

---

## 39. 后台编辑器按钮固定定位

**问题描述**：后台写文章页面的保存/发布按钮需要固定在页面底部。

**解决方案**：
- 文件：`src/app/(admin)/admin/posts/new/page.tsx` 和 `[id]/page.tsx`
- 从 `sticky` 改为 `fixed` 定位
- 桌面端考虑侧边栏偏移

```tsx
<div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t px-6 py-4 lg:left-64">
```

- 同时为内容区添加底部内边距 `pb-24` 防止内容被遮挡

---

## 40. TypeScript 编译错误 - Prisma 类型问题

**问题描述**：
```
Type '{ categoryId: string; } | { categoryId: { is: DbNull; }; }' is not assignable to type 'PostWhereInput'
```

**原因分析**：
- 当 `categoryId` 为 `null` 时，使用 `categoryId: { is: Prisma.DbNull }`
- TypeScript 无法正确推断类型，导致联合类型错误

**解决方案**：
- 文件：`src/server/features/post/post.service.ts`
- 使用类型断言 `as Prisma.PostWhereInput`

```tsx
const prevPost = await prisma.post.findFirst({
  where: {
    status: 'PUBLISHED',
    deletedAt: null,
    id: { not: currentId },
    ...(categoryId
      ? { categoryId, [sortField]: { gt: sortValue } }
      : { categoryId: { is: Prisma.DbNull }, [sortField]: { gt: sortValue } }
    ),
  } as Prisma.PostWhereInput,
  ...
});
```

---

## 问题汇总表

| 编号 | 问题 | 文件 | 关键词 |
|------|------|------|--------|
| 34 | 侧边栏布局 | `layout.tsx` | `fixed`, `ml-64` |
| 35 | 目录默认显示 | `post/[id]/page.tsx` | `isTOCVisible` |
| 36 | 代码块复制 | `post/[id]/page.tsx` | `CodeBlock`, `clipboard` |
| 37 | 语法高亮 | `post/[id]/page.tsx` | `rehype-highlight`, `aliases` |
| 38 | 评论输入框 | `CommentSection.tsx` | `bg-background` |
| 39 | 按钮固定 | `posts/new/page.tsx` | `fixed`, `lg:left-64` |
| 40 | Prisma 类型 | `post.service.ts` | `as Prisma.PostWhereInput` |

---

## 41. npm/pnpm 混用导致 node_modules 混乱

**问题**：`@prisma/client` 模块找不到，错误路径指向 `.pnpm` 目录

**原因**：混用 npm 和 pnpm 安装依赖，导致 node_modules 结构混乱

**解决**：选择一个包管理器，彻底清理后重装
```bash
rm -rf node_modules .next
rm -f package-lock.json pnpm-lock.yaml
pnpm install
pnpm prisma generate
```

---

## 42. Prisma Client 未生成

**问题**：`MODULE_NOT_FOUND @prisma/client`

**原因**：修改 schema.prisma 后未重新生成 Client

**解决**：
```bash
pnpm prisma generate
# 或
npx prisma generate
```

---

## 43. 注册接口验证失败

**问题**：注册返回 `code: 4220, message: "Required"`，提示 `confirmPassword` 和 `captcha` 为必填

**原因**：前端注册页面只传了 `name/email/password`，但 API 使用完整验证 schema

**解决**：API 层使用精简验证 schema（captcha 在前端已验证）
```typescript
const registerApiSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})
```

**文件**：
- `src/app/api/auth/register/route.ts`
- `src/app/register/page.tsx`

---

## 44. 文章详情页无限请求接口

**问题**：页面疯狂调用获取文章列表接口

**原因**：`loadMoreCategoryArticles` 的 useCallback 依赖 `isLoadingMore`，而函数内部调用 `setIsLoadingMore(true/false)`，导致回调不断重建，触发 effect 重复执行

**解决**：用 `ref` 替代 `state` 做判断条件，避免循环
```typescript
const isLoadingMoreRef = useRef(false);

const loadMoreCategoryArticles = useCallback(async (signal) => {
  if (!article?.category?.id || isLoadingMoreRef.current || !hasMore) return;
  isLoadingMoreRef.current = true;
  // ... fetch ...
  isLoadingMoreRef.current = false;
}, [article?.category?.id, categoryPage, hasMore]); // 移除 isLoadingMore
```

**文件**：`src/app/(public)/post/[id]/page.tsx`

---

## 45. 注册用户无角色

**问题**：新注册用户没有任何角色，无法区分权限

**说明**：当前注册接口只创建用户记录，未分配角色

**文件**：`src/app/api/auth/register/route.ts`

---

## 46. 后台可查看所有用户文章

**问题**：admin 页面能看到所有用户的文章，未按 authorId 过滤

**说明**：当前 `getPosts` 在 admin 模式下未传 authorId 过滤条件

**文件**：`src/server/features/post/post.service.ts`

