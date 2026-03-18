# 个人博客系统 — API 接口文档

版本：v1.1
日期：2026-03-18
状态：已更新
更新说明：同步需求文档和技术设计文档，修正单分类设计，补充验证码、敏感词等接口

---

## 目录

- [1. 接口规范说明](#1-接口规范说明)
- [2. 前台 API 接口](#2-前台-api-接口)
- [3. 后台 API 接口](#3-后台-api-接口)
- [4. 错误码说明](#4-错误码说明)
- [5. 附录](#5-附录)

---

## 1. 接口规范说明

### 1.1 基础信息

- **Base URL**: `https://api.blog.com/api/v1`
- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8

### 1.2 标准响应结构

所有接口都遵循统一的响应格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": 1707219200000
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | Number | 业务状态码 |
| `message` | String | 响应消息 |
| `data` | Any | 响应数据 |
| `timestamp` | Number | 响应时间戳（毫秒） |

### 1.3 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 422 | 数据验证失败 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 1.4 分页参数

所有列表接口都支持以下分页参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | Number | 否 | 1 | 页码 |
| `pageSize` | Number | 否 | 10 | 每页数量（最大 100） |

**分页响应数据：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  },
  "timestamp": 1707219200000
}
```

### 1.5 认证方式

后台 API 需要携带认证 Token：

```http
Authorization: Bearer {token}
```

### 1.6 缓存控制

部分接口支持缓存，响应头中包含：

```http
Cache-Control: public, max-age=600
```

**缓存策略：**

| 接口类型 | 缓存时间 | 说明 |
|----------|----------|------|
| 首页文章列表 | 10 分钟 | 文章发布/更新时主动失效 |
| 分类/标签列表 | 1 小时 | 分类/标签变更时主动失效 |
| 文章详情 | 10 分钟 | ISR 增量静态再生 |
| 热门文章 | 10 分钟 | 数据变更时主动失效 |

---

## 2. 前台 API 接口

### 2.1 文章模块

#### 2.1.1 获取文章列表

**接口描述：** 获取已发布的文章列表

**请求方式：** `GET /posts`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | Number | 否 | 页码 |
| `pageSize` | Number | 否 | 每页数量 |
| `categoryId` | String | 否 | 分类 ID（单分类） |
| `tagId` | String | 否 | 标签 ID |
| `keyword` | String | 否 | 搜索关键词 |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cm123456789",
        "title": "Next.js 14 最佳实践",
        "slug": "nextjs-14-best-practices",
        "summary": "本文介绍了 Next.js 14 的核心特性...",
        "coverImage": "https://cdn.blog.com/images/cover.jpg",
        "viewCount": 1234,
        "likeCount": 56,
        "commentCount": 12,
        "readingTime": 8,
        "isPinned": true,
        "publishedAt": "2026-02-26T10:00:00Z",
        "category": {
          "id": "cm987654321",
          "name": "前端开发",
          "slug": "frontend"
        },
        "tags": [
          {
            "id": "cm111111111",
            "name": "Next.js",
            "slug": "nextjs"
          }
        ],
        "author": {
          "id": "cm000000001",
          "name": "Admin",
          "avatar": "https://cdn.blog.com/avatars/admin.jpg"
        }
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 10,
    "totalPages": 5
  },
  "timestamp": 1707219200000
}
```

#### 2.1.2 获取文章详情

**接口描述：** 根据 slug 获取文章详情

**请求方式：** `GET /posts/{slug}`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | String | 是 | 文章 slug |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "cm123456789",
    "title": "Next.js 14 最佳实践",
    "slug": "nextjs-14-best-practices",
    "content": "# Next.js 14 最佳实践\n\n本文介绍...",
    "summary": "本文介绍了 Next.js 14 的核心特性...",
    "coverImage": "https://cdn.blog.com/images/cover.jpg",
    "viewCount": 1234,
    "likeCount": 56,
    "commentCount": 12,
    "readingTime": 8,
    "seoTitle": "Next.js 14 最佳实践 | 我的博客",
    "seoDesc": "深入讲解 Next.js 14 的核心特性和最佳实践",
    "keywords": ["Next.js", "React", "SSR"],
    "publishedAt": "2026-02-26T10:00:00Z",
    "category": {
      "id": "cm987654321",
      "name": "前端开发",
      "slug": "frontend"
    },
    "tags": [
      {
        "id": "cm111111111",
        "name": "Next.js",
        "slug": "nextjs"
      }
    ],
    "author": {
      "id": "cm000000001",
      "name": "Admin",
      "avatar": "https://cdn.blog.com/avatars/admin.jpg"
    },
    "prevPost": {
      "id": "cm123456788",
      "title": "React Server Components 详解",
      "slug": "react-server-components"
    },
    "nextPost": {
      "id": "cm123456790",
      "title": "TypeScript 高级类型体操",
      "slug": "typescript-advanced-types"
    }
  },
  "timestamp": 1707219200000
}
```

#### 2.1.3 点赞文章

**接口描述：** 点赞文章（防刷：同一 IP 仅一次）

**请求方式：** `POST /posts/{id}/like`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 文章 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "已点赞",
  "data": {
    "likeCount": 57,
    "liked": true
  },
  "timestamp": 1707219200000
}
```

**错误响应：**

```json
{
  "code": 429,
  "message": "已点过赞了",
  "data": null,
  "timestamp": 1707219200000
}
```

#### 2.1.4 增加浏览量

**接口描述：** 增加文章浏览量（防刷：同一 IP 10 分钟内只计一次）

**请求方式：** `POST /posts/{id}/view`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 文章 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "viewCount": 1235,
    "counted": true
  },
  "timestamp": 1707219200000
}
```

### 2.2 评论模块

#### 2.2.1 获取评论列表

**接口描述：** 获取文章评论列表（仅显示已审核通过的评论）

**请求方式：** `GET /posts/{postId}/comments`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `postId` | String | 是 | 文章 ID |

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | Number | 否 | 1 | 页码 |
| `pageSize` | Number | 否 | 10 | 每页数量 |
| `sortBy` | String | 否 | `createdAt` | 排序字段（createdAt, likeCount） |
| `order` | String | 否 | `desc` | 排序方向（asc, desc） |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cm111111111",
        "content": "这篇文章写得很棒！",
        "nickname": "访客",
        "avatar": "https://www.gravatar.com/avatar/xxx",
        "website": "https://example.com",
        "likeCount": 5,
        "createdAt": "2026-02-26T12:00:00Z",
        "replies": [
          {
            "id": "cm111111112",
            "content": "谢谢支持！",
            "nickname": "Admin",
            "avatar": "https://cdn.blog.com/avatars/admin.jpg",
            "createdAt": "2026-02-26T13:00:00Z"
          }
        ]
      }
    ],
    "total": 20,
    "page": 1,
    "pageSize": 10,
    "totalPages": 2
  },
  "timestamp": 1707219200000
}
```

#### 2.2.2 提交评论

**接口描述：** 提交文章评论（需要图片验证码，1 分钟 1 条/IP）

**请求方式：** `POST /posts/{postId}/comments`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `postId` | String | 是 | 文章 ID |

**请求体：**

```json
{
  "content": "这篇文章写得很棒！",
  "nickname": "访客",
  "email": "visitor@example.com",
  "website": "https://example.com",
  "parentId": "cm111111111",
  "captchaCode": "aB3d"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | String | 是 | 评论内容（1-500 字） |
| `nickname` | String | 是 | 昵称（1-20 字符） |
| `email` | String | 否 | 邮箱（用于 Gravatar 头像） |
| `website` | String | 否 | 个人网站 |
| `parentId` | String | 否 | 父评论 ID（回复时使用，仅支持一级回复） |
| `captchaCode` | String | 是 | 图片验证码（4 位字符） |

**响应示例：**

```json
{
  "code": 200,
  "message": "评论提交成功，等待审核后将显示",
  "data": {
    "id": "cm111111113",
    "content": "这篇文章写得很棒！",
    "nickname": "访客",
    "avatar": "https://www.gravatar.com/avatar/xxx",
    "status": "PENDING",
    "createdAt": "2026-02-26T14:00:00Z"
  },
  "timestamp": 1707219200000
}
```

**错误响应：**

```json
{
  "code": 422,
  "message": "验证码错误，请重新输入",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 429,
  "message": "评论太频繁，请稍后再试",
  "data": {
    "retryAfter": 60
  },
  "timestamp": 1707219200000
}
```

#### 2.2.3 点赞评论

**接口描述：** 点赞评论（防刷：同一 IP 仅一次）

**请求方式：** `POST /comments/{id}/like`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 评论 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "已点赞",
  "data": {
    "likeCount": 6,
    "liked": true
  },
  "timestamp": 1707219200000
}
```

### 2.3 验证码模块

#### 2.3.1 获取图片验证码

**接口描述：** 获取图片验证码（用于评论、登录）

**请求方式：** `GET /captcha`

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | String | 否 | 类型（comment, login），默认 comment |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "captchaId": "cm123456789",
    "captchaImage": "data:image/png;base64,iVBORw0KG...",
    "expiresIn": 300
  },
  "timestamp": 1707219200000
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `captchaId` | String | 验证码 ID，提交时需要 |
| `captchaImage` | String | Base64 编码的图片数据 |
| `expiresIn` | Number | 有效期（秒），300 秒 = 5 分钟 |

**验证码规格：**

- 类型：图片验证码
- 格式：4 位字符（大小写字母 + 数字组合）
- 有效期：5 分钟
- 错误处理：错误 3 次后强制刷新

### 2.4 分类模块

#### 2.4.1 获取分类列表

**接口描述：** 获取所有文章分类

**请求方式：** `GET /categories`

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "cm987654321",
      "name": "前端开发",
      "slug": "frontend",
      "description": "前端技术相关文章",
      "postCount": 25
    },
    {
      "id": "cm987654322",
      "name": "后端开发",
      "slug": "backend",
      "description": "后端技术相关文章",
      "postCount": 18
    }
  ],
  "timestamp": 1707219200000
}
```

#### 2.4.2 获取分类详情

**接口描述：** 获取分类详情及文章列表

**请求方式：** `GET /categories/{slug}`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | String | 是 | 分类 slug |

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | Number | 否 | 1 | 页码 |
| `pageSize` | Number | 否 | 10 | 每页数量 |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "cm987654321",
    "name": "前端开发",
    "slug": "frontend",
    "description": "前端技术相关文章",
    "postCount": 25,
    "posts": {
      "items": [
        {
          "id": "cm123456789",
          "title": "Next.js 14 最佳实践",
          "slug": "nextjs-14-best-practices",
          "summary": "本文介绍了...",
          "viewCount": 1234,
          "publishedAt": "2026-02-26T10:00:00Z"
        }
      ],
      "total": 25,
      "page": 1,
      "pageSize": 10,
      "totalPages": 3
    }
  },
  "timestamp": 1707219200000
}
```

### 2.5 标签模块

#### 2.5.1 获取标签列表

**接口描述：** 获取所有文章标签

**请求方式：** `GET /tags`

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "cm111111111",
      "name": "Next.js",
      "slug": "nextjs",
      "postCount": 12
    },
    {
      "id": "cm111111112",
      "name": "React",
      "slug": "react",
      "postCount": 18
    }
  ],
  "timestamp": 1707219200000
}
```

### 2.6 搜索模块

#### 2.6.1 搜索文章

**接口描述：** 全文搜索文章（标题 + 内容）

**请求方式：** `GET /search`

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | String | 是 | 搜索关键词 |
| `page` | Number | 否 | 页码 |
| `pageSize` | Number | 否 | 每页数量 |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cm123456789",
        "title": "Next.js 14 最佳实践",
        "slug": "nextjs-14-best-practices",
        "summary": "本文介绍了 Next.js 14 的核心特性...",
        "highlight": "<em>Next.js</em> 14 <em>最佳实践</em>",
        "publishedAt": "2026-02-26T10:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  },
  "timestamp": 1707219200000
}
```

**无结果响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "pageSize": 10,
    "totalPages": 0
  },
  "timestamp": 1707219200000
}
```

### 2.7 热门文章

#### 2.7.1 获取热门文章

**接口描述：** 获取热门文章排行榜

**请求方式：** `GET /posts/trending`

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `limit` | Number | 否 | 10 | 返回数量（最大 50） |
| `timeframe` | String | 否 | `all` | 时间范围（day, week, month, all） |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "cm123456789",
      "title": "Next.js 14 最佳实践",
      "slug": "nextjs-14-best-practices",
      "viewCount": 5432,
      "likeCount": 123,
      "commentCount": 45,
      "hotScore": 3289.2
    }
  ],
  "timestamp": 1707219200000
}
```

**热度计算公式：**

```
热度 = 阅读量 × 0.6 + 点赞 × 0.3 + 评论 × 0.1
```

### 2.8 创作记录

#### 2.8.1 获取创作热力图

**接口描述：** 获取指定年份的创作热力图数据

**请求方式：** `GET /posts/heatmap`

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `year` | Number | 否 | 当前年份 | 年份 |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "year": 2026,
    "total": 150,
    "contributions": [
      {
        "date": "2026-01-15",
        "count": 2,
        "actions": ["publish", "edit"]
      },
      {
        "date": "2026-01-16",
        "count": 1,
        "actions": ["publish"]
      }
    ]
  },
  "timestamp": 1707219200000
}
```

**动作类型：**

| 值 | 说明 |
|------|------|
| `publish` | 发布文章 |
| `edit` | 编辑文章 |
| `delete` | 删除文章 |

### 2.9 RSS 订阅

#### 2.9.1 获取 RSS 订阅

**接口描述：** 获取 RSS 2.0 订阅源

**请求方式：** `GET /rss.xml`

**响应类型：** `application/rss+xml`

**响应内容：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>我的博客</title>
    <link>https://blog.com</link>
    <description>记录技术成长</description>
    <item>
      <title>Next.js 14 最佳实践</title>
      <link>https://blog.com/post/nextjs-14-best-practices</link>
      <description>本文介绍了 Next.js 14 的核心特性...</description>
      <pubDate>Thu, 26 Feb 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

---

## 3. 后台 API 接口

> ⚠️ 所有后台接口都需要认证，请在请求头中携带 Token：
> ```http
> Authorization: Bearer {token}
> ```

### 3.1 认证模块

#### 3.1.1 管理员登录

**接口描述：** 管理员登录获取 Token（需要图片验证码）

**请求方式：** `POST /auth/login`

**请求体：**

```json
{
  "email": "admin@blog.com",
  "password": "your_password",
  "captchaId": "cm123456789",
  "captchaCode": "aB3d"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | String | 是 | 邮箱 |
| `password` | String | 是 | 密码 |
| `captchaId` | String | 是 | 验证码 ID |
| `captchaCode` | String | 是 | 验证码（4 位字符） |

**响应示例：**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "cm000000001",
      "name": "Admin",
      "email": "admin@blog.com",
      "avatar": "https://cdn.blog.com/avatars/admin.jpg",
      "roles": ["admin"]
    },
    "expiresAt": "2026-02-27T10:00:00Z"
  },
  "timestamp": 1707219200000
}
```

**错误响应：**

```json
{
  "code": 401,
  "message": "用户名或密码错误，请重新输入",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 429,
  "message": "登录失败次数过多，请 15 分钟后再试",
  "data": {
    "retryAfter": 900
  },
  "timestamp": 1707219200000
}
```

#### 3.1.2 获取当前用户信息

**接口描述：** 获取当前登录用户信息

**请求方式：** `GET /auth/me`

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "cm000000001",
    "name": "Admin",
    "email": "admin@blog.com",
    "avatar": "https://cdn.blog.com/avatars/admin.jpg",
    "roles": [
      {
        "id": "cm000000001",
        "name": "admin",
        "description": "超级管理员"
      }
    ],
    "permissions": [
      "post:create",
      "post:update",
      "post:delete",
      "comment:approve"
    ]
  },
  "timestamp": 1707219200000
}
```

#### 3.1.3 登出

**接口描述：** 登出（使 Token 失效）

**请求方式：** `POST /auth/logout`

**响应示例：**

```json
{
  "code": 200,
  "message": "登出成功",
  "data": null,
  "timestamp": 1707219200000
}
```

### 3.2 文章管理模块

#### 3.2.1 获取文章列表（后台）

**接口描述：** 获取所有文章（包括草稿、已删除）

**请求方式：** `GET /admin/posts`

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | Number | 否 | 1 | 页码 |
| `pageSize` | Number | 否 | 10 | 每页数量 |
| `status` | String | 否 | - | 状态筛选（DRAFT, PUBLISHED, ARCHIVED, DELETED） |
| `keyword` | String | 否 | - | 搜索关键词 |
| `categoryId` | String | 否 | - | 分类 ID（单分类） |
| `authorId` | String | 否 | - | 作者 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cm123456789",
        "title": "Next.js 14 最佳实践",
        "slug": "nextjs-14-best-practices",
        "status": "PUBLISHED",
        "viewCount": 1234,
        "likeCount": 56,
        "commentCount": 12,
        "publishedAt": "2026-02-26T10:00:00Z",
        "createdAt": "2026-02-25T15:00:00Z",
        "updatedAt": "2026-02-26T10:00:00Z",
        "category": {
          "id": "cm987654321",
          "name": "前端开发",
          "slug": "frontend"
        },
        "author": {
          "id": "cm000000001",
          "name": "Admin"
        }
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 10,
    "totalPages": 5
  },
  "timestamp": 1707219200000
}
```

#### 3.2.2 创建文章

**接口描述：** 创建新文章

**请求方式：** `POST /admin/posts`

**请求体：**

```json
{
  "title": "Next.js 14 最佳实践",
  "slug": "nextjs-14-best-practices",
  "content": "# Next.js 14 最佳实践\n\n本文介绍...",
  "summary": "本文介绍了 Next.js 14 的核心特性",
  "coverImage": "https://cdn.blog.com/images/cover.jpg",
  "categoryId": "cm987654321",
  "tagIds": ["cm111111111", "cm111111112"],
  "status": "DRAFT",
  "seoTitle": "Next.js 14 最佳实践 | 我的博客",
  "seoDesc": "深入讲解 Next.js 14 的核心特性",
  "keywords": "Next.js,React,SSR",
  "isPinned": false
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | String | 是 | 标题（1-200 字符） |
| `slug` | String | 否 | URL 标识符（自动生成） |
| `content` | String | 是 | Markdown 内容 |
| `summary` | String | 否 | 摘要（可自动提取） |
| `coverImage` | String | 否 | 封面图 URL |
| `categoryId` | String | 否 | 分类 ID（单分类） |
| `tagIds` | String[] | 否 | 标签 ID 数组 |
| `status` | String | 否 | 状态（DRAFT, PUBLISHED, ARCHIVED） |
| `seoTitle` | String | 否 | SEO 标题 |
| `seoDesc` | String | 否 | SEO 描述 |
| `keywords` | String | 否 | 关键词（逗号分隔） |
| `isPinned` | Boolean | 否 | 是否置顶 |

**响应示例：**

```json
{
  "code": 201,
  "message": "创建成功",
  "data": {
    "id": "cm123456789",
    "title": "Next.js 14 最佳实践",
    "slug": "nextjs-14-best-practices",
    "status": "DRAFT",
    "createdAt": "2026-02-26T15:00:00Z"
  },
  "timestamp": 1707219200000
}
```

#### 3.2.3 更新文章

**接口描述：** 更新文章信息

**请求方式：** `PUT /admin/posts/{id}`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 文章 ID |

**请求体：** 同创建文章

**响应示例：**

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": "cm123456789",
    "title": "Next.js 14 最佳实践（更新版）",
    "slug": "nextjs-14-best-practices",
    "status": "PUBLISHED",
    "updatedAt": "2026-02-26T16:00:00Z"
  },
  "timestamp": 1707219200000
}
```

#### 3.2.4 删除文章

**接口描述：** 删除文章（软删除，30 天后物理删除）

**请求方式：** `DELETE /admin/posts/{id}`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 文章 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "删除成功，可在回收站恢复（保留 30 天）",
  "data": null,
  "timestamp": 1707219200000
}
```

#### 3.2.5 批量删除文章

**接口描述：** 批量删除文章（软删除）

**请求方式：** `POST /admin/posts/batch-delete`

**请求体：**

```json
{
  "ids": ["cm123456789", "cm123456790", "cm123456791"]
}
```

**响应示例：**

```json
{
  "code": 200,
  "message": "成功删除 3 篇文章",
  "data": {
    "count": 3
  },
  "timestamp": 1707219200000
}
```

#### 3.2.6 发布文章

**接口描述：** 发布文章（DRAFT → PUBLISHED）

**请求方式：** `POST /admin/posts/{id}/publish`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 文章 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "发布成功",
  "data": {
    "id": "cm123456789",
    "status": "PUBLISHED",
    "publishedAt": "2026-02-26T17:00:00Z"
  },
  "timestamp": 1707219200000
}
```

#### 3.2.7 保存草稿

**接口描述：** 保存文章草稿（自动保存每 30 秒触发）

**请求方式：** `POST /admin/posts/{id}/draft`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 文章 ID |

**请求体：** 同创建文章

**响应示例：**

```json
{
  "code": 200,
  "message": "保存成功",
  "data": {
    "id": "cm123456789",
    "status": "DRAFT",
    "updatedAt": "2026-02-26T17:30:00Z"
  },
  "timestamp": 1707219200000
}
```

#### 3.2.8 恢复已删除文章

**接口描述：** 恢复回收站中的文章

**请求方式：** `POST /admin/posts/{id}/restore`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 文章 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "恢复成功",
  "data": {
    "id": "cm123456789",
    "status": "DRAFT"
  },
  "timestamp": 1707219200000
}
```

### 3.3 评论管理模块

#### 3.3.1 获取评论列表（后台）

**接口描述：** 获取所有评论（包括待审核）

**请求方式：** `GET /admin/comments`

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | Number | 否 | 1 | 页码 |
| `pageSize` | Number | 否 | 10 | 每页数量 |
| `status` | String | 否 | - | 状态筛选（PENDING, APPROVED, REJECTED） |
| `keyword` | String | 否 | - | 搜索关键词 |
| `postId` | String | 否 | - | 文章 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cm111111111",
        "content": "这篇文章写得很棒！",
        "nickname": "访客",
        "email": "visitor@example.com",
        "ip": "192.168.1.*",
        "userAgent": "Mozilla/5.0...",
        "status": "PENDING",
        "createdAt": "2026-02-26T12:00:00Z",
        "post": {
          "id": "cm123456789",
          "title": "Next.js 14 最佳实践",
          "slug": "nextjs-14-best-practices"
        }
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 10,
    "totalPages": 5
  },
  "timestamp": 1707219200000
}
```

**注意：** IP 地址后三位掩码显示（如 192.168.1.*），仅管理员可查看完整 IP。

#### 3.3.2 审核评论

**接口描述：** 审核通过或拒绝评论

**请求方式：** `POST /admin/comments/{id}/review`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 评论 ID |

**请求体：**

```json
{
  "action": "approve"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | String | 是 | 操作（approve 通过，reject 拒绝） |

**响应示例：**

```json
{
  "code": 200,
  "message": "审核通过",
  "data": {
    "id": "cm111111111",
    "status": "APPROVED"
  },
  "timestamp": 1707219200000
}
```

#### 3.3.3 批量审核评论

**接口描述：** 批量审核评论

**请求方式：** `POST /admin/comments/batch-review`

**请求体：**

```json
{
  "ids": ["cm111111111", "cm111111112", "cm111111113"],
  "action": "approve"
}
```

**响应示例：**

```json
{
  "code": 200,
  "message": "成功审核 3 条评论",
  "data": {
    "count": 3
  },
  "timestamp": 1707219200000
}
```

#### 3.3.4 删除评论

**接口描述：** 删除评论

**请求方式：** `DELETE /admin/comments/{id}`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String | 是 | 评论 ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null,
  "timestamp": 1707219200000
}
```

### 3.4 分类管理模块

#### 3.4.1 创建分类

**接口描述：** 创建文章分类（单分类，每篇文章只能属于一个分类）

**请求方式：** `POST /admin/categories`

**请求体：**

```json
{
  "name": "前端开发",
  "slug": "frontend",
  "description": "前端技术相关文章"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | String | 是 | 分类名称 |
| `slug` | String | 否 | URL 标识符（自动生成） |
| `description` | String | 否 | 分类描述 |

**响应示例：**

```json
{
  "code": 201,
  "message": "创建成功",
  "data": {
    "id": "cm987654321",
    "name": "前端开发",
    "slug": "frontend",
    "description": "前端技术相关文章",
    "postCount": 0
  },
  "timestamp": 1707219200000
}
```

#### 3.4.2 更新分类

**请求方式：** `PUT /admin/categories/{id}`

**请求体：** 同创建分类

#### 3.4.3 删除分类

**请求方式：** `DELETE /admin/categories/{id}`

**响应示例：**

```json
{
  "code": 409,
  "message": "该分类下有 5 篇文章，请先移动或删除这些文章",
  "data": {
    "postCount": 5
  },
  "timestamp": 1707219200000
}
```

**注意：** 删除分类前需要先处理关联的文章。

### 3.5 标签管理模块

#### 3.5.1 创建标签

**请求方式：** `POST /admin/tags`

**请求体：**

```json
{
  "name": "Next.js",
  "slug": "nextjs"
}
```

**响应示例：**

```json
{
  "code": 201,
  "message": "创建成功",
  "data": {
    "id": "cm111111111",
    "name": "Next.js",
    "slug": "nextjs",
    "postCount": 0
  },
  "timestamp": 1707219200000
}
```

#### 3.5.2 更新标签

**请求方式：** `PUT /admin/tags/{id}`

**请求体：** 同创建标签

#### 3.5.3 删除标签

**请求方式：** `DELETE /admin/tags/{id}`

**响应示例：**

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null,
  "timestamp": 1707219200000
}
```

**注意：** 删除标签不会删除关联的文章，仅解除关联。

### 3.6 敏感词管理模块

#### 3.6.1 获取敏感词列表

**接口描述：** 获取所有敏感词

**请求方式：** `GET /admin/sensitive-words`

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | Number | 否 | 1 | 页码 |
| `pageSize` | Number | 否 | 10 | 每页数量 |
| `category` | String | 否 | - | 分类筛选 |
| `isActive` | Boolean | 否 | - | 是否启用 |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cm123456789",
        "word": "敏感词示例",
        "category": "广告",
        "isActive": true,
        "createdAt": "2026-02-26T10:00:00Z"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 10,
    "totalPages": 5
  },
  "timestamp": 1707219200000
}
```

#### 3.6.2 创建敏感词

**接口描述：** 创建敏感词

**请求方式：** `POST /admin/sensitive-words`

**请求体：**

```json
{
  "word": "敏感词示例",
  "category": "广告",
  "isActive": true
}
```

**响应示例：**

```json
{
  "code": 201,
  "message": "创建成功",
  "data": {
    "id": "cm123456789",
    "word": "敏感词示例",
    "category": "广告",
    "isActive": true
  },
  "timestamp": 1707219200000
}
```

#### 3.6.3 删除敏感词

**接口描述：** 删除敏感词

**请求方式：** `DELETE /admin/sensitive-words/{id}`

**响应示例：**

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null,
  "timestamp": 1707219200000
}
```

#### 3.6.4 批量导入敏感词

**接口描述：** 批量导入敏感词

**请求方式：** `POST /admin/sensitive-words/import`

**请求类型：** `multipart/form-data`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | CSV/TXT 文件 |

**响应示例：**

```json
{
  "code": 200,
  "message": "成功导入 100 个敏感词",
  "data": {
    "imported": 100,
    "skipped": 5
  },
  "timestamp": 1707219200000
}
```

### 3.7 数据统计模块

#### 3.7.1 获取仪表盘数据

**接口描述：** 获取后台仪表盘统计数据

**请求方式：** `GET /admin/dashboard/stats`

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "overview": {
      "totalPosts": 150,
      "publishedPosts": 120,
      "draftPosts": 25,
      "deletedPosts": 5,
      "totalComments": 350,
      "pendingComments": 12,
      "totalViews": 125000,
      "totalLikes": 8500
    },
    "trend": {
      "viewCount": 5432,
      "likeCount": 123,
      "commentCount": 45,
      "postCount": 8
    },
    "popularPosts": [
      {
        "id": "cm123456789",
        "title": "Next.js 14 最佳实践",
        "viewCount": 5432
      }
    ],
    "recentComments": [
      {
        "id": "cm111111111",
        "content": "这篇文章写得很棒！",
        "nickname": "访客",
        "status": "PENDING",
        "createdAt": "2026-02-26T12:00:00Z"
      }
    ]
  },
  "timestamp": 1707219200000
}
```

#### 3.7.2 获取阅读量趋势

**接口描述：** 获取阅读量趋势数据

**请求方式：** `GET /admin/stats/views/trend`

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `timeframe` | String | 否 | `7d` | 时间范围（7d, 30d, 90d, 1y） |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "timeline": [
      {
        "date": "2026-02-20",
        "views": 1234
      },
      {
        "date": "2026-02-21",
        "views": 1456
      }
    ],
    "total": 8765,
    "average": 1252,
    "growth": 15.6
  },
  "timestamp": 1707219200000
}
```

#### 3.7.3 获取热门文章

**接口描述：** 获取热门文章排行

**请求方式：** `GET /admin/stats/popular-posts`

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `limit` | Number | 否 | 10 | 返回数量 |
| `timeframe` | String | 否 | `all` | 时间范围（day, week, month, all） |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "cm123456789",
      "title": "Next.js 14 最佳实践",
      "slug": "nextjs-14-best-practices",
      "viewCount": 5432,
      "likeCount": 123,
      "commentCount": 45,
      "hotScore": 3289.2
    }
  ],
  "timestamp": 1707219200000
}
```

### 3.8 系统设置模块

#### 3.8.1 获取系统配置

**请求方式：** `GET /admin/settings`

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "site": {
      "name": "我的博客",
      "description": "记录技术成长",
      "keywords": ["前端", "后端", "全栈"],
      "logo": "https://cdn.blog.com/logo.png"
    },
    "seo": {
      "title": "我的博客 - 记录技术成长",
      "description": "分享前端、后端、全栈开发技术",
      "ogImage": "https://cdn.blog.com/og.png"
    },
    "comment": {
      "autoApprove": false,
      "requireEmail": false,
      "requireCaptcha": true
    },
    "social": {
      "github": "https://github.com/xxx",
      "twitter": "https://twitter.com/xxx",
      "weibo": "https://weibo.com/xxx"
    }
  },
  "timestamp": 1707219200000
}
```

#### 3.8.2 更新系统配置

**请求方式：** `PUT /admin/settings`

**请求体：** 同获取系统配置的数据结构

**响应示例：**

```json
{
  "code": 200,
  "message": "更新成功",
  "data": null,
  "timestamp": 1707219200000
}
```

### 3.9 文件上传模块

#### 3.9.1 上传图片

**接口描述：** 上传图片（支持拖拽、粘贴）

**请求方式：** `POST /admin/upload/image`

**请求类型：** `multipart/form-data`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 图片文件 |
| `type` | String | 否 | 类型（post, avatar, category） |

**支持的图片格式：**

- PNG
- JPG/JPEG
- GIF
- WebP

**响应示例：**

```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "url": "https://cdn.blog.com/images/xxx.jpg",
    "filename": "xxx.jpg",
    "size": 123456,
    "width": 1920,
    "height": 1080
  },
  "timestamp": 1707219200000
}
```

### 3.10 审计日志模块

#### 3.10.1 获取审计日志

**接口描述：** 获取管理员操作审计日志

**请求方式：** `GET /admin/audit-logs`

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | Number | 否 | 1 | 页码 |
| `pageSize` | Number | 否 | 10 | 每页数量 |
| `userId` | String | 否 | - | 用户 ID |
| `action` | String | 否 | - | 操作类型 |
| `startDate` | String | 否 | - | 开始时间 |
| `endDate` | String | 否 | - | 结束时间 |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cm123456789",
        "userId": "cm000000001",
        "userName": "Admin",
        "action": "post.publish",
        "target": "cm123456788",
        "details": "{\"title\": \"Next.js 14 最佳实践\"}",
        "ipAddress": "192.168.1.100",
        "createdAt": "2026-02-26T10:00:00Z"
      }
    ],
    "total": 500,
    "page": 1,
    "pageSize": 10,
    "totalPages": 50
  },
  "timestamp": 1707219200000
}
```

**操作类型：**

| 值 | 说明 |
|------|------|
| `auth.login` | 登录 |
| `auth.logout` | 登出 |
| `post.create` | 创建文章 |
| `post.update` | 更新文章 |
| `post.delete` | 删除文章 |
| `post.publish` | 发布文章 |
| `comment.approve` | 审核通过评论 |
| `comment.reject` | 拒绝评论 |
| `comment.delete` | 删除评论 |
| `settings.update` | 更新系统设置 |

---

## 4. 错误码说明

### 4.1 业务状态码

| 状态码 | 说明 | 示例 |
|--------|------|------|
| 200 | 成功 | 请求成功 |
| 201 | 创建成功 | 文章创建成功 |
| 400 | 请求参数错误 | 缺少必填参数 |
| 401 | 未认证 | Token 无效或过期 |
| 403 | 无权限 | 权限不足 |
| 404 | 资源不存在 | 文章不存在 |
| 409 | 资源冲突 | slug 已存在 |
| 422 | 数据验证失败 | 邮箱格式错误 |
| 429 | 请求过于频繁 | 触发限流 |
| 500 | 服务器内部错误 | 服务器异常 |
| 503 | 服务不可用 | 系统维护中 |

### 4.2 错误响应格式

```json
{
  "code": 400,
  "message": "请求参数错误",
  "data": {
    "errors": [
      {
        "field": "title",
        "message": "标题不能为空"
      },
      {
        "field": "email",
        "message": "邮箱格式不正确"
      }
    ]
  },
  "timestamp": 1707219200000
}
```

### 4.3 常见错误响应

#### 4.3.1 认证相关

```json
{
  "code": 401,
  "message": "用户名或密码错误，请重新输入",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 401,
  "message": "验证码错误，请重新输入",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 401,
  "message": "验证码已过期，请点击刷新",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 429,
  "message": "登录失败次数过多，请 15 分钟后再试",
  "data": {
    "retryAfter": 900
  },
  "timestamp": 1707219200000
}
```

```json
{
  "code": 401,
  "message": "会话已过期，请重新登录",
  "data": null,
  "timestamp": 1707219200000
}
```

#### 4.3.2 文章管理相关

```json
{
  "code": 422,
  "message": "标题不能为空",
  "data": {
    "errors": [
      {
        "field": "title",
        "message": "标题不能为空"
      }
    ]
  },
  "timestamp": 1707219200000
}
```

```json
{
  "code": 422,
  "message": "标题长度不能超过 200 字符",
  "data": {
    "errors": [
      {
        "field": "title",
        "message": "标题长度不能超过 200 字符"
      }
    ]
  },
  "timestamp": 1707219200000
}
```

```json
{
  "code": 500,
  "message": "保存失败，请检查网络连接后重试",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 500,
  "message": "发布失败，请检查网络连接后重试",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 404,
  "message": "文章不存在或已被删除",
  "data": null,
  "timestamp": 1707219200000
}
```

#### 4.3.3 评论管理相关

```json
{
  "code": 422,
  "message": "请输入昵称",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 422,
  "message": "昵称长度不能超过 20 字符",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 422,
  "message": "请输入评论内容",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 422,
  "message": "评论内容不能超过 500 字",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 429,
  "message": "评论太频繁，请稍后再试",
  "data": {
    "retryAfter": 60
  },
  "timestamp": 1707219200000
}
```

#### 4.3.4 通用错误

```json
{
  "code": 500,
  "message": "网络连接失败，请检查网络设置",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 500,
  "message": "服务器开小差了，请稍后再试",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 403,
  "message": "权限不足，无法执行此操作",
  "data": {
    "requiredPermission": "post:delete"
  },
  "timestamp": 1707219200000
}
```

```json
{
  "code": 404,
  "message": "数据加载失败，请刷新页面重试",
  "data": null,
  "timestamp": 1707219200000
}
```

### 4.4 成功响应

```json
{
  "code": 200,
  "message": "登录成功，欢迎回来！",
  "data": {...},
  "timestamp": 1707219200000
}
```

```json
{
  "code": 200,
  "message": "保存成功",
  "data": {...},
  "timestamp": 1707219200000
}
```

```json
{
  "code": 200,
  "message": "发布成功",
  "data": {...},
  "timestamp": 1707219200000
}
```

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null,
  "timestamp": 1707219200000
}
```

```json
{
  "code": 200,
  "message": "审核通过",
  "data": {...},
  "timestamp": 1707219200000
}
```

```json
{
  "code": 200,
  "message": "已点赞",
  "data": {...},
  "timestamp": 1707219200000
}
```

```json
{
  "code": 200,
  "message": "链接已复制",
  "data": null,
  "timestamp": 1707219200000
}
```

---

## 5. 附录

### 5.1 枚举值说明

#### 5.1.1 文章状态 (PostStatus)

| 值 | 说明 |
|------|------|
| `DRAFT` | 草稿 |
| `PUBLISHED` | 已发布 |
| `ARCHIVED` | 已归档 |
| `DELETED` | 已删除（软删除） |

#### 5.1.2 评论状态 (CommentStatus)

| 值 | 说明 |
|------|------|
| `PENDING` | 待审核 |
| `APPROVED` | 已通过 |
| `REJECTED` | 已拒绝 |

### 5.2 权限代码说明

| 权限代码 | 说明 |
|----------|------|
| `post:create` | 创建文章 |
| `post:update` | 更新文章 |
| `post:delete` | 删除文章 |
| `post:publish` | 发布文章 |
| `comment:approve` | 审核通过评论 |
| `comment:reject` | 拒绝评论 |
| `comment:delete` | 删除评论 |
| `dashboard:view` | 查看仪表盘 |
| `settings:update` | 修改系统设置 |

### 5.3 数据类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `String` | 字符串 | CUID、UUID、文本 |
| `Number` | 数字 | 整数、浮点数 |
| `Boolean` | 布尔值 | true、false |
| `DateTime` | 日期时间 | ISO 8601 格式 |
| `Array` | 数组 | 对象数组 |
| `Object` | 对象 | JSON 对象 |

### 5.4 时间格式

所有时间字段遵循 **ISO 8601** 标准：

```
2026-02-26T10:00:00Z
```

时区统一使用 **UTC**。

### 5.5 版本管理

API 版本通过 URL 路径进行管理：

- **v1**: `/api/v1/*` (当前版本)
- **v2**: `/api/v2/*` (未来版本)

### 5.6 变更日志

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1.0 | 2026-02-26 | 初始版本 |
| v1.1 | 2026-03-18 | 同步需求和设计文档：修正单分类设计、补充验证码接口、敏感词管理接口、文章 SEO 字段、软删除状态、评论点赞功能、错误响应文案规范 |

---

## 6. 注意事项

### 6.1 安全建议

- ✅ 所有后台接口必须使用 HTTPS
- ✅ Token 有效期建议为 24 小时
- ✅ 登录需要图片验证码
- ✅ 登录失败 5 次后锁定 15 分钟
- ✅ 评论需要频率限制（1 分钟 1 条/IP）
- ✅ 点赞需要防刷（同一 IP 仅一次）
- ✅ 敏感词过滤（评论自动标记待审核）
- ✅ 上传文件需要限制类型（白名单）

### 6.2 性能优化

- ✅ 列表接口默认返回 10 条数据
- ✅ 启用 Redis 缓存热点数据
- ✅ 启用 Gzip/Brotli 压缩
- ✅ 使用 CDN 加速静态资源
- ✅ 图片懒加载
- ✅ 数据库查询使用索引

### 6.3 兼容性

- ✅ 支持 Chrome 最新版本
- ✅ 支持 Firefox 最新版本
- ✅ 支持 Safari 最新版本
- ✅ 支持 Edge 最新版本
- ✅ 移动端优先设计

### 6.4 缓存策略

| 数据类型 | 缓存位置 | 缓存时间 | 失效条件 |
|----------|----------|----------|----------|
| 首页文章列表 | Redis | 10 分钟 | 文章发布/更新/删除 |
| 热门文章 | Redis | 10 分钟 | 数据变更 |
| 分类/标签列表 | Redis | 1 小时 | 分类/标签变更 |
| 文章详情 | ISR | 10 分钟 | 文章更新 |
| 用户会话 | Redis | 24 小时 | 登出/过期 |
| 阅读/点赞计数 | Redis | 实时 | 定期同步到 MySQL |

---

**文档更新日期：** 2026-03-18
**文档版本：** v1.1
**文档维护者：** 技术团队
