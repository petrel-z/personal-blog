import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: true, linkify: false, typographer: false })

function tokenText(tokens: ReturnType<typeof markdown.parse>): string {
  return tokens.map(token => {
    // Parse HTML so it can be discarded, never rendered or executed.
    if (token.type === 'html_inline' || token.type === 'html_block') return ''
    if (token.children) return tokenText(token.children)
    if (token.type === 'text' || token.type === 'code_inline' || token.type === 'image') return token.content
    if (token.type === 'fence' || token.type === 'code_block') return ` ${token.content} `
    return token.block || token.type === 'softbreak' || token.type === 'hardbreak' ? ' ' : ''
  }).join('')
}

function plainText(source: string): string {
  return tokenText(markdown.parse(source, {})).replace(/\s+/g, ' ').trim()
}

/** Prisma contains uses LIKE: escape its wildcard and escape characters. */
export function escapeSearchKeyword(keyword: string): string {
  return keyword.replace(/[\\%_]/g, '\\$&')
}

/** Strip Markdown before locating and truncating a match; return text, never HTML. */
export function createSearchExcerpt(summary: string | null, content: string, keyword: string): string {
  const summaryText = plainText(summary ?? '')
  const pattern = new RegExp(keyword.replace(/\s+/g, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu')
  let text = summaryText
  if (!pattern.test(summaryText)) {
    const contentText = plainText(content)
    text = pattern.test(contentText) ? contentText : summaryText || contentText
  }

  const match = text.search(pattern)
  const characters = Array.from(text)
  const matchPosition = match < 0 ? 0 : Array.from(text.slice(0, match)).length
  const start = Math.max(0, matchPosition - 40)
  const end = Math.min(characters.length, start + 160)

  return `${start > 0 ? '…' : ''}${characters.slice(start, end).join('')}${end < characters.length ? '…' : ''}`
}
