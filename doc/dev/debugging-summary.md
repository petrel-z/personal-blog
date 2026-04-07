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
