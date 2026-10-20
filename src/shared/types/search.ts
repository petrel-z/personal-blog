export interface SearchResultItem {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImage: string | null
  publishedAt: string | null
  category: { id: string; name: string; slug: string } | null
  tags: { id: string; name: string; slug: string }[]
}
