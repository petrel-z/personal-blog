# API Client

基于 fetch 的统一 API 请求封装。

## 文件结构

```
api/
├── fetch.ts    # fetch 封装，提供 get/post/put/patch/delete 方法
└── index.ts   # 业务 API 封装（postsApi, commentsApi 等）
```

## 使用方式

```typescript
import { api, postsApi, commentsApi } from '@/client/api'

// 方式一：直接使用 api 方法
const res = await api.get('/posts', { page: 1, pageSize: 10 })
if (res.success) {
  console.log(res.data)
}

// 方式二：使用封装好的业务 API
const res = await postsApi.list({ page: 1, pageSize: 10 })
if (res.success) {
  console.log(res.data, res.total, res.page)
}
```

## 响应格式

```typescript
interface ApiResponse<T> {
  success: boolean       // 请求是否成功
  data?: T              // 数据（成功时）
  error?: string        // 错误信息（失败时）
  message?: string      // 提示信息
  total?: number        // 总数（分页）
  page?: number         // 当前页（分页）
  pageSize?: number     // 每页大小（分页）
  totalPages?: number   // 总页数（分页）
}
```
