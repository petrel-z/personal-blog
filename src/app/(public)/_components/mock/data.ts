/**
 * Mock Data - 模拟数据
 */

export interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  publishDate: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  coverImage?: string;
  isPinned?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  count: number;
}

export interface Comment {
  id: string;
  nickname: string;
  content: string;
  date: string;
  replies?: Comment[];
}

export const categories: Category[] = [
  { id: '1', name: '观影笔记', slug: 'movie-notes', count: 8 },
  { id: '2', name: '生活笔记', slug: 'life-notes', count: 39 },
  { id: '3', name: '阅读笔记', slug: 'reading-notes', count: 150 },
  { id: '4', name: '优惠资讯', slug: 'deals', count: 5 },
  { id: '5', name: '主机资讯', slug: 'hosting', count: 9 },
  { id: '6', name: '随笔思考', slug: 'essays', count: 27 },
  { id: '7', name: '好文转载', slug: 'reposts', count: 26 },
  { id: '8', name: '技术笔记', slug: 'tech-notes', count: 656 },
  { id: '9', name: '个人项目', slug: 'projects', count: 12 },
];

export const articles: Article[] = [
  {
    id: '1',
    title: '快速选出收益最高的理财产品 | finance-calculator',
    slug: 'finance-calculator',
    summary: '每次对比各种理财产品的时候，都会遇到一些问题：一是一很难有一个统一的指标来比对；二是各家算法不一致，很容易...',
    content: `# 快速选出收益最高的理财产品

每次对比各种理财产品的时候，都会遇到一些问题：一是一很难有一个统一的指标来比对；二是各家算法不一致，很容易...

## 为什么需要这个工具？

在理财时，我们经常看到"年化收益率"、"七日年化"、"万份收益"等不同的指标。这个工具可以帮助你统一计算。

### 核心功能

- 支持多种算法
- 实时对比
- 历史记录保存

## 代码实现

\`\`\`javascript
function calculateYield(principal, days, interest) {
  return (interest / principal) * (365 / days) * 100;
}
\`\`\`

## 总结

理财有风险，投资需谨慎。`,
    category: '技术笔记',
    tags: ['finance', 'calculator', 'tool'],
    publishDate: '2025-06-15',
    viewCount: 4533,
    likeCount: 128,
    commentCount: 0,
    isPinned: true,
    coverImage: 'https://picsum.photos/seed/finance/800/400',
  },
  {
    id: '2',
    title: 'ceph mon Operation not permitted 问题解决',
    slug: 'ceph-mon-operation-not-permitted',
    summary: '自己构建的 ceph 发现 mon 起不来，报错如下：Apr 03 11:14:30 debian sy...',
    content: `# ceph mon Operation not permitted 问题解决

自己构建的 ceph 发现 mon 起不来，报错如下：Apr 03 11:14:30 debian sy...

## 问题描述

在启动 ceph-mon 时遇到权限错误。

## 解决方法

检查目录权限并确保用户正确。

\`\`\`bash
chown -R ceph:ceph /var/lib/ceph/mon
\`\`\``,
    category: '技术笔记',
    tags: ['ceph', 'linux', 'storage'],
    publishDate: '2026-04-03',
    viewCount: 1240,
    likeCount: 45,
    commentCount: 2,
    coverImage: 'https://picsum.photos/seed/ceph/800/400',
  },
  {
    id: '3',
    title: 'Ascend 310P + openFuyao + NPU-Operator 故障排查',
    slug: 'ascend-310p-npu-operator',
    summary: '[TOC]故障 pod describe[root@master1 ~]# kubectl -n kub...',
    content: `# Ascend 310P + openFuyao + NPU-Operator 故障排查

[TOC]故障 pod describe[root@master1 ~]# kubectl -n kub...

## 故障现象

Pod 无法正常调度到 NPU 节点。

## 排查步骤

1. 检查驱动状态
2. 检查 NPU-Operator 日志`,
    category: '技术笔记',
    tags: ['ascend', 'npu', 'kubernetes'],
    publishDate: '2026-04-01',
    viewCount: 890,
    likeCount: 32,
    commentCount: 1,
    coverImage: 'https://picsum.photos/seed/npu/800/400',
  },
];

export const tags = [
  'linux', 'Kubernetes', 'docker', '2021', 'AI', '2022', 'git', 'vim', 'macOS', 'PVE', 'KVM', 'k3s', 'Perl', 'Bullet Journal', 'windows', 'ByAIGC', '名侦探柯南', 'wordpress', 'Ubuntu', 'k8s', 'vps', 'GitLab', 'debian', 'vue', 'android', 'ArchLinux', '哈利·波特', 'Ruby', 'github', 'python'
];
