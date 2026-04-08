/**
 * ArticleDetail - 文章详情页
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import Slugger from "github-slugger"; // 导入 Slugger
import {
  Calendar,
  Eye,
  ThumbsUp,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Share2,
  Copy,
  Check,
  List,
} from "lucide-react";
import { api } from "@/client/api";
import { TableOfContents } from "../../_components/TableOfContents";
import { CommentSection } from "../../_components/CommentSection";
import { cn } from "@/lib/utils";
import type { PostWithRelations } from "@/shared/types";
import { PageError } from "@/components/shared/page-error";
import { formatDate } from "@/shared/utils";

// 移除 GitHub 风格的 slugify 函数，因为我们将使用 github-slugger

// 解析 Markdown 内容提取目录（处理重复 id）
function parseTOC(
  content: string,
): { id: string; text: string; level: number }[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const items: { id: string; text: string; level: number }[] = [];
  const slugger = new Slugger(); // 在每次解析时创建新的 Slugger 实例
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugger.slug(text); // 使用 github-slugger 生成 id，它会自动处理重复

    items.push({ id, text, level });
  }

  return items;
}

export default function ArticleDetail() {
  const params = useParams();
  const id = params.id as string;

  const [article, setArticle] = useState<PostWithRelations | null>(null);
  const [categoryArticles, setCategoryArticles] = useState<PostWithRelations[]>(
    [],
  );
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isTOCVisible, setIsTOCVisible] = useState(false); // 默认隐藏
  const [isCategoryListVisible, setIsCategoryListVisible] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(true); // 页面初始加载
  const [isArticleLoading, setIsArticleLoading] = useState(false); // 文章切换加载

  // 左侧分类文章列表分页状态
  const [categoryPage, setCategoryPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sentinelRef, setSentinelRef] = useState<HTMLDivElement | null>(null);
  const isFirstLoad = useRef(true);

  // 内容区域滚动 ref
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // 解析目录内容
  const tocItems = parseTOC(article?.content || "");

  const hasTOCItems = tocItems.length > 0;

  // 滚动到指定 id 的元素
  const scrollToHeading = (id: string) => {
    const container = contentScrollRef.current;
    if (!container) {
      console.warn("Scroll container not found."); // 添加日志
      return;
    }

    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with ID "${id}" not found.`); // 添加日志
      return;
    }

    // 用 getBoundingClientRect 计算元素相对于容器的位置
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scrollTop =
      elementRect.top - containerRect.top + container.scrollTop - 20;

    console.log(
      `Scrolling to ID: ${id}, ScrollTop: ${scrollTop}, Element Top: ${elementRect.top}, Container Top: ${containerRect.top}, Container ScrollTop: ${container.scrollTop}`,
    ); // 添加更详细的日志
    container.scrollTo({
      top: scrollTop,
      behavior: "smooth",
    });
  };

  // 获取文章详情
  const fetchArticle = useCallback(
    async (signal: AbortSignal) => {
      try {
        // 首次加载显示 loading，后续切换只显示顶部进度条
        if (isFirstLoad.current) {
          setIsPageLoading(true);
        } else {
          setIsArticleLoading(true);
        }

        const result = (await api.get(`/posts/${id}`, undefined, {
          signal,
        })) as { code: number; data: PostWithRelations; message: string };
        if (result.code === 2000 && result.data) {
          setArticle(result.data);
          setLikeCount(result.data.likeCount || 0);
          isFirstLoad.current = false;

          // Fetch first page of articles in the same category
          if (result.data.category?.id) {
            setCategoryPage(1);
            const postsResult = (await api.get(
              "/posts",
              {
                categoryId: result.data.category.id,
                page: 1,
                pageSize: 10,
              },
              { signal },
            )) as {
              code: number;
              data: { items: PostWithRelations[]; total: number };
              message: string;
            };
            if (postsResult.code === 2000 && postsResult.data) {
              setCategoryArticles(postsResult.data.items || []);
              setHasMore(
                postsResult.data.items?.length < postsResult.data.total,
              );
            }
          }
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("Failed to fetch article:", error);
      } finally {
        setIsPageLoading(false);
        setIsArticleLoading(false);
      }
    },
    [id],
  );

  // 加载更多分类文章
  const loadMoreCategoryArticles = useCallback(
    async (signal: AbortSignal) => {
      if (!article?.category?.id || isLoadingMore || !hasMore) return;

      try {
        setIsLoadingMore(true);
        const nextPage = categoryPage + 1;
        const postsResult = (await api.get(
          "/posts",
          {
            categoryId: article.category.id,
            page: nextPage,
            pageSize: 10,
          },
          { signal },
        )) as {
          code: number;
          data: { items: PostWithRelations[]; total: number };
          message: string;
        };

        if (postsResult.code === 2000 && postsResult.data) {
          const newItems = postsResult.data.items || [];
          setCategoryArticles((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const uniqueNewItems = newItems.filter(
              (item) => !existingIds.has(item.id),
            );
            const updatedItems = [...prev, ...uniqueNewItems];
            setHasMore(updatedItems.length < postsResult.data.total);
            return updatedItems;
          });
          setCategoryPage(nextPage);
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("Failed to load more articles:", error);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [article?.category?.id, categoryPage, isLoadingMore, hasMore],
  );

  // 获取文章 - id 变化时执行
  useEffect(() => {
    const abortController = new AbortController();

    // 重置状态
    isFirstLoad.current = true;
    setArticle(null);
    setCategoryArticles([]);
    setLikeCount(0);
    setIsPageLoading(true);
    setIsTOCVisible(false); // 默认隐藏目录

    // 延迟一点执行，让状态先重置
    const timer = setTimeout(() => {
      fetchArticle(abortController.signal);
    }, 0);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [id, fetchArticle]);

  // 滚动加载更多
  useEffect(() => {
    if (!sentinelRef || !isCategoryListVisible) return;

    const abortController = new AbortController();
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          loadMoreCategoryArticles(abortController.signal);
        }
      },
      { rootMargin: "100px" },
    );

    observer.observe(sentinelRef);
    return () => {
      observer.disconnect();
      abortController.abort();
    };
  }, [
    sentinelRef,
    hasMore,
    isLoadingMore,
    isCategoryListVisible,
    loadMoreCategoryArticles,
  ]);

  const readingTime = article?.content
    ? Math.ceil(article.content.length / 300)
    : 0;

  const handleLike = () => {
    if (!isLiked) {
      setIsLiked(true);
      setLikeCount((prev) => prev + 1);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isPageLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-text-muted">加载中...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-main mb-4">文章不存在</h1>
          <Link href="/" className="text-primary hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageError>
      <div className="flex h-full w-full overflow-hidden relative">
        {/* 切换文章时的顶部加载进度条 */}
        {isArticleLoading && (
          <div className="absolute top-0 left-0 right-0 z-50 h-0.5 bg-primary/20">
            <div className="h-full bg-primary animate-pulse w-full" />
          </div>
        )}

        {/* Left Column: Category Articles (1/4 width) */}
        <div
          className={cn(
            "hidden lg:flex flex-col border-r border-border bg-background transition-all duration-300 ease-in-out flex-shrink-0 relative",
            isCategoryListVisible ? "lg:w-1/5" : "lg:w-0",
            !isCategoryListVisible && "border-none",
          )}
        >
          {isCategoryListVisible && (
            <div className="w-full max-w-[280px] flex flex-col h-full overflow-hidden">
              <div className="p-4 h-14 border-b border-border flex items-center justify-between flex-shrink-0">
                <h3 className="text-xs font-bold text-text-muted flex items-center gap-2 truncate">
                  <List size={14} />
                  {article.category?.name || "未分类"}
                </h3>
                <button
                  onClick={() => setIsCategoryListVisible(false)}
                  className="p-1.5 rounded hover:bg-sidebar-active/50 text-text-muted transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-2">
                  {categoryArticles.map((item) => {
                    const isActive = item.id === id;
                    return (
                      <Link
                        key={item.id}
                        href={`/post/${item.id}`}
                        className={cn(
                          "block py-2 px-3 rounded text-xs transition-colors line-clamp-2",
                          isActive
                            ? "bg-primary/10 text-primary font-bold"
                            : "text-text-muted hover:bg-sidebar-active/50 hover:text-text-main",
                        )}
                      >
                        {item.title}
                      </Link>
                    );
                  })}

                  {/* Sentinel for infinite scroll */}
                  <div ref={setSentinelRef} className="h-4" />

                  {/* Loading indicator */}
                  {isLoadingMore && (
                    <div className="py-2 px-3 text-xs text-text-muted text-center">
                      加载中...
                    </div>
                  )}

                  {/* No more items */}
                  {!hasMore && categoryArticles.length > 0 && (
                    <div className="py-2 px-3 text-xs text-text-muted text-center">
                      没有更多文章了
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toggle Category List Button (Fixed when hidden) */}
        {!isCategoryListVisible && (
          <div className="absolute left-0 top-4 z-40 pl-4">
            <button
              onClick={() => setIsCategoryListVisible(true)}
              className="w-10 h-10 rounded-lg bg-card shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-all hover:shadow-lg"
            >
              <List size={20} />
            </button>
          </div>
        )}

        {/* Main Content Area (2/4 width, Scrollable) */}
        <div
          ref={contentScrollRef}
          className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar"
        >
          <div className="max-w-4xl mx-auto w-full px-8 py-4">
            <article className="overflow-hidden">
              {/* Header */}
              <header className="space-y-4 mb-8 pb-8 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                    <span>{article.category?.name || "未分类"}</span>
                    <span>/</span>
                    <span className="text-primary">
                      {article.tags?.[0]?.name || ""}
                    </span>
                  </div>
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold text-text-main leading-tight">
                  {article.title}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-[10px] text-text-muted uppercase tracking-wider font-bold">
                  <div className="flex items-center gap-1.5">
                    <User size={12} />
                    <span>{article.author?.name || "匿名"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    <span>{formatDate(article.publishedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye size={12} />
                    <span>{article.viewCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{readingTime} min</span>
                  </div>
                </div>
              </header>

              {/* Content */}
              <div className="prose dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[
                    rehypeSanitize,
                    rehypeSlug,
                    rehypeRaw,
                    rehypeHighlight,
                  ]}
                >
                  {article.content}
                </ReactMarkdown>
              </div>

              {/* Actions */}
              <div className="mt-16 flex flex-col items-center gap-6 py-10 border-t border-border">
                <button
                  onClick={handleLike}
                  disabled={isLiked}
                  className={`flex flex-col items-center gap-2 group transition-all ${
                    isLiked
                      ? "text-primary"
                      : "text-text-muted hover:text-primary"
                  }`}
                >
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${
                      isLiked
                        ? "bg-primary/10 border-primary shadow-lg shadow-primary/20"
                        : "border-border group-hover:border-primary group-hover:bg-primary/5"
                    }`}
                  >
                    <ThumbsUp
                      size={28}
                      className={isLiked ? "fill-primary" : ""}
                    />
                  </div>
                  <span className="text-sm font-bold">{likeCount} 点赞</span>
                </button>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sidebar-active/30 text-text-muted hover:text-primary transition-all text-xs font-bold"
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    {isCopied ? "已复制" : "复制链接"}
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sidebar-active/30 text-text-muted hover:text-primary transition-all text-xs font-bold">
                    <Share2 size={14} />
                    分享
                  </button>
                </div>
              </div>

              {/* Prev/Next Navigation */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {article.prev ? (
                  <Link
                    href={`/post/${article.prev.id}`}
                    className="p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                      <ChevronLeft size={12} />
                      上一篇
                    </div>
                    <div className="text-sm font-bold text-text-main group-hover:text-primary transition-colors line-clamp-1">
                      {article.prev.title}
                    </div>
                  </Link>
                ) : (
                  <div className="p-4 rounded-xl border border-border opacity-50">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                      <ChevronLeft size={12} />
                      上一篇
                    </div>
                    <div className="text-sm text-text-muted line-clamp-1">
                      没有更早的文章了
                    </div>
                  </div>
                )}

                {article.next ? (
                  <Link
                    href={`/post/${article.next.id}`}
                    className="p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group text-right"
                  >
                    <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                      下一篇
                      <ChevronRight size={12} />
                    </div>
                    <div className="text-sm font-bold text-text-main group-hover:text-primary transition-colors line-clamp-1">
                      {article.next.title}
                    </div>
                  </Link>
                ) : (
                  <div className="p-4 rounded-xl border border-border opacity-50 text-right">
                    <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                      下一篇
                      <ChevronRight size={12} />
                    </div>
                    <div className="text-sm text-text-muted line-clamp-1">
                      没有更新的文章了
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Comments */}
            <CommentSection postId={article.id} />

            {/* Footer inside scrollable area */}
            <footer className="mt-20 py-6 border-t border-border">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-text-muted">
                <p>© 2026 Petrel-Z. Powered by AI Studio.</p>
                <div className="flex items-center gap-4">
                  <a
                    href="/about"
                    className="hover:text-primary transition-colors"
                  >
                    关于本站
                  </a>
                  <a
                    href="/guestbook"
                    className="hover:text-primary transition-colors"
                  >
                    留言板
                  </a>
                  <a
                    href="/rss"
                    className="hover:text-primary transition-colors"
                  >
                    RSS 订阅
                  </a>
                  <a
                    href="/links"
                    className="hover:text-primary transition-colors"
                  >
                    友情链接
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </div>

        {/* Right Column: TOC (1/4 width) */}
        <div
          className={cn(
            "hidden lg:flex flex-col border-l border-border bg-background transition-all duration-300 ease-in-out flex-shrink-0 h-full relative",
            isTOCVisible ? "lg:w-1/5" : "lg:w-0",
            !isTOCVisible && "border-none",
          )}
        >
          {isTOCVisible && (
            <div className="w-full max-w-[280px] h-full flex flex-col overflow-hidden ml-auto">
              <div className="p-4 h-14 border-b border-border flex items-center justify-between flex-shrink-0">
                <h3 className="text-xs font-bold text-text-muted flex items-center gap-2">
                  <List size={14} />
                  文章目录
                </h3>
                <button
                  onClick={() => setIsTOCVisible(false)}
                  className="p-1.5 rounded hover:bg-sidebar-active/50 text-text-muted transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <TableOfContents
                  items={tocItems}
                  onToggle={() => setIsTOCVisible(false)}
                  onScrollTo={scrollToHeading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Toggle TOC Button (Always show when hidden) */}
        {!isTOCVisible && (
          <div className="absolute right-0 top-4 z-40 pr-8">
            <button
              onClick={() => setIsTOCVisible(true)}
              className="w-10 h-10 rounded-lg bg-card shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-all hover:shadow-lg"
            >
              <List size={20} />
            </button>
          </div>
        )}
      </div>
    </PageError>
  );
}
