/** Prisma contains uses LIKE: escape its wildcard and escape characters. */
export function escapeSearchKeyword(keyword: string): string {
  return keyword.replace(/[\\%_]/g, '\\$&')
}

/** Return text, never generated HTML; presentation/highlighting belongs to the UI. */
export function createSearchExcerpt(summary: string | null, content: string, keyword: string): string {
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
  const summaryText = normalize(summary ?? '')
  const contentText = normalize(content)
  const pattern = new RegExp(normalize(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu')
  const text = pattern.test(summaryText) ? summaryText
    : pattern.test(contentText) ? contentText : summaryText || contentText

  const match = text.search(pattern)
  const characters = Array.from(text)
  const matchPosition = match < 0 ? 0 : Array.from(text.slice(0, match)).length
  const start = Math.max(0, matchPosition - 40)
  const end = Math.min(characters.length, start + 160)

  return `${start > 0 ? '…' : ''}${characters.slice(start, end).join('')}${end < characters.length ? '…' : ''}`
}
