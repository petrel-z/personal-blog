# 前台开发计划

版本：v1.0
日期：2026-04-05
模块：前台系统（Visitor Side）

---

## 一、项目概述

前台面向技术读者，提供文章阅读、搜索、评论互动、内容发现等功能。

### 1.1 技术栈

- Next.js 14 App Router (RSC)
- Tailwind CSS + Shadcn/ui
- React Markdown + rehype 高亮
- Zustand 状态管理
- next-themes 主题切换

### 1.2 页面清单

| 页面 | 路径 | 优先级 |
|------|------|--------|
| 首页 | `/` | P0 |
| 文章详情 | `/post/[slug]` | P0 |
| 分类页 | `/category/[slug]` | P0 |
| 搜索页 | `/search` | P0 |
| 分类总览 | `/categories` | P1 |
| 热度排行 | `/trending` | P1 |
| 创作记录 | `/archive` | P1 |
| 关于我 | `/about` | P2 |
| RSS | `/rss.xml` | P2 |
| 404 | - | P0 |

---

## 二、任务模块

---

### M1: 首页模块 (P0)

#### 1.1 文章列表组件

**任务：**
- 创建 `ArticleCard` 组件
  - 显示：标题、摘要、分类、标签、发布时间、阅读量、点赞数、评论数、封面图、预计阅读时间
  - 交互：点击标题跳转详情、支持分页
- 创建 `ArticleList` 组件
  - 布局：网格/列表切换
  - 状态：loading骨架屏、空状态、无结果
- 创建 `Pagination` 组件

**文件：**
```
src/app/(public)/_components/
├── ArticleCard.tsx
├── ArticleList.tsx
└── Pagination.tsx
```

**依赖：** API `/api/posts`

#### 1.2 首页布局

**任务：**
- 更新 `page.tsx` 实现文章列表
- 集成 `ArticleList` 组件
- 实现首屏加载优化

---

### M2: 文章详情模块 (P0)

#### 2.1 文章正文渲染

**任务：**
- 创建 `PostContent` 组件
  - Markdown 渲染 (react-markdown)
  - 代码高亮 (rehype-highlight)
  - 代码块一键复制按钮
  - 图片自适应、懒加载
- 创建 `TableOfContents` 组件
  - 基于 h1/h2/h3 自动生成
  - 平滑滚动定位
  - 当前章节高亮
  - 移动端抽屉模式

**文件：**
```
src/app/(public)/_components/
├── PostContent.tsx
├── TableOfContents.tsx
├── CodeBlock.tsx
└── CopyButton.tsx
```

#### 2.2 文章元信息

**任务：**
- 创建 `PostMeta` 组件
  - 作者信息（头像、名称）
  - 发布时间、分类、标签
  - 阅读量、点赞数
  - 预计阅读时间
- 创建 `PostActions` 组件
  - 点赞按钮（防重复点击）
  - 分享按钮（复制链接）

#### 2.3 上一篇/下一篇导航

**任务：**
- 创建 `PostNavigation` 组件
  - 上一篇/下一篇链接
  - 根据来源上下文切换（分类内/全站）
  - 边界处理（无文章时隐藏）

#### 2.4 相关推荐

**任务：**
- 创建 `RelatedPosts` 组件
  - 同分类文章推荐
  - 显示：标题、发布时间、阅读量

**文件：**
```
src/app/(public)/_components/
├── PostMeta.tsx
├── PostActions.tsx
├── PostNavigation.tsx
└── RelatedPosts.tsx
```

#### 2.5 文章页面

**任务：**
- 更新 `/post/[slug]/page.tsx`
- 集成所有文章详情组件
- 实现 SEO 元数据 (generateMetadata)
- 实现阅读量自动上报

---

### M3: 评论模块 (P0)

#### 3.1 评论列表

**任务：**
- 创建 `CommentList` 组件
  - 显示：昵称、头像(Gravatar)、时间、内容
  - 支持一级回复嵌套展示
  - 分页（每页10条）
- 创建 `CommentItem` 组件

**文件：**
```
src/app/(public)/_components/comments/
├── CommentList.tsx
├── CommentItem.tsx
└── ReplyForm.tsx
```

#### 3.2 评论表单

**任务：**
- 创建 `CommentForm` 组件
  - 字段：昵称、邮箱、网站、评论内容
  - 图片验证码 (4位)
  - 频率限制提示 (1分钟1条)
- 创建 `CaptchaImage` 组件
  - 显示验证码图片
  - 点击刷新
  - 键盘空格刷新

#### 3.3 评论交互

**任务：**
- 创建 `CommentActions` 组件
  - 点赞按钮
  - 回复按钮

**文件：**
```
src/app/(public)/_components/comments/
├── CommentForm.tsx
├── CaptchaImage.tsx
└── CommentActions.tsx
```

---

### M4: 分类模块 (P0)

#### 4.1 分类总览页

**任务：**
- 创建 `CategoryCard` 组件
  - 显示：名称、描述、文章数量
- 更新 `/categories/page.tsx`
  - 网格布局展示所有分类
  - 点击跳转分类文章列表

**文件：**
```
src/app/(public)/_components/
└── CategoryCard.tsx
```

#### 4.2 分类文章列表

**任务：**
- 更新 `/category/[slug]/page.tsx`
- 复用 `ArticleList` 组件
- 显示当前分类信息
- 支持分页

---

### M5: 搜索模块 (P0)

#### 5.1 搜索功能

**任务：**
- 创建 `SearchBar` 组件
  - 防抖输入 (500ms)
  - 回车触发
  - 清空按钮
- 创建 `SearchResults` 组件
  - 关键词高亮
  - 无结果提示
  - 搜索历史记录 (localStorage)

**文件：**
```
src/app/(public)/_components/
├── SearchBar.tsx
└── SearchResults.tsx
```

#### 5.2 搜索页面

**任务：**
- 更新 `/search/page.tsx`
- 集成 `SearchBar` 和 `SearchResults`
- 显示搜索统计

---

### M6: 热度排行模块 (P1)

#### 6.1 排行榜

**任务：**
- 创建 `TrendingList` 组件
  - 显示：排名、标题、阅读量、点赞数、评论数、热度分
  - 热度计算：阅读量×0.6 + 点赞×0.3 + 评论×0.1
- 创建 `TrendingFilters` 组件
  - 总榜 / 本月榜 / 本周榜

**文件：**
```
src/app/(public)/_components/
├── TrendingList.tsx
└── TrendingFilters.tsx
```

#### 6.2 排行榜页面

**任务：**
- 更新 `/trending/page.tsx`
- 集成 `TrendingList` 和 `TrendingFilters`

---

### M7: 创作记录模块 (P1)

#### 7.1 热力图

**任务：**
- 创建 `ContributionGraph` 组件
  - GitHub 风格热力图
  - 按年展示
  - 点击日期查看详情弹窗

**文件：**
```
src/app/(public)/_components/
└── ContributionGraph.tsx
```

#### 7.2 创作记录页面

**任务：**
- 更新 `/archive/page.tsx`
- 集成 `ContributionGraph`
- 年份切换器

---

### M8: 关于我模块 (P2)

#### 8.1 页面内容

**任务：**
- 更新 `/about/page.tsx`
- Markdown 渲染个人介绍
- 社交链接展示
- 头像展示

---

### M9: 主题与国际化 (P1/P2)

#### 9.1 主题切换

**任务：**
- 集成 `next-themes`
- Header 添加主题切换按钮
- 支持：浅色、深色、自动跟随系统
- 持久化 (localStorage)

#### 9.2 多语言支持 (P2)

**任务：**
- 创建 `i18n` 配置
- 支持：中文、英文
- 范围：菜单、提示、按钮文案

---

### M10: 通用组件

#### 10.1 Header

**任务：**
- 创建 `Header` 组件
  - Logo、导航菜单
  - 搜索按钮、主题切换
  - 移动端汉堡菜单

**文件：**
```
src/components/shared/
├── Header.tsx
└── Footer.tsx
```

#### 10.2 Footer

**任务：**
- 创建 `Footer` 组件
  - 版权信息
  - 社交链接
  - 导航链接

#### 10.3 骨架屏

**任务：**
- 创建通用骨架屏组件
- `SkeletonCard`、`SkeletonText`、`SkeletonAvatar`

**文件：**
```
src/components/ui/
└── skeleton.tsx
```

#### 10.4 Toast

**任务：**
- 集成 Shadcn `toaster`
- 错误/成功提示

---

### M11: 样式与性能

#### 11.1 全局样式

**任务：**
- 更新 `globals.css`
- CSS 变量定义
- 响应式断点

#### 11.2 性能优化

**任务：**
- 图片懒加载实现
- 组件动态导入
- 字体优化

---

## 三、依赖关系

```
M1 (首页) ──────► M10 (Header/Footer)
                    │
M2 (文章详情) ─────► M3 (评论) ◄──── M10
     │
     ├── M4 (分类) ───► M1 (ArticleCard)
     │
     └── M6 (排行) ───► M1 (ArticleCard)

M5 (搜索) ──────► M10 (Header)
M7 (创作记录) ───► M10 (Header)
M8 (关于我) ─────► M10 (Header)
```

---

## 四、验收标准

- [ ] 首页文章列表正常显示，支持分页
- [ ] 文章详情页 Markdown 渲染正常，代码高亮生效
- [ ] 目录组件正常生成，可滚动定位
- [ ] 点赞功能正常，防重复点击
- [ ] 评论提交成功，验证码有效
- [ ] 搜索功能正常，关键词高亮
- [ ] 分类页正常显示和跳转
- [ ] 热度排行计算正确
- [ ] 暗黑模式切换正常
- [ ] 响应式布局正常
- [ ] Lighthouse 性能评分 > 90

---

## 五、技术债务

- [ ] 分享功能（微信二维码、微博跳转）
- [ ] RSS 订阅 `/rss.xml`
- [ ] 多语言切换
- [ ] 图片上传组件（文章内嵌图）
