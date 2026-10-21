export function splitSearchHighlight(text: string, keyword: string): { text: string; matched: boolean }[] {
  const query = keyword.trim()
  if (!query) return [{ text, matched: false }]
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const parts: { text: string; matched: boolean }[] = []
  let offset = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index), matched: false })
    parts.push({ text: match[0], matched: true })
    offset = match.index + match[0].length
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), matched: false })
  return parts.length ? parts : [{ text, matched: false }]
}
