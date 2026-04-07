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
