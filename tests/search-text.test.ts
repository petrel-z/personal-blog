import { createSearchExcerpt } from '@/server/features/search/search-text'

test('uses the summary when it contains the keyword', () => {
  expect(createSearchExcerpt('介绍权限校验的实现。', '正文内容', '权限')).toBe('介绍权限校验的实现。')
})

test('shows a match deep in the article when the summary does not match', () => {
  const result = createSearchExcerpt('普通简介', '开头 '.repeat(200) + '权限校验' + '结束 '.repeat(200), '权限')
  expect(result).toContain('权限校验')
  expect(result.startsWith('…')).toBe(true)
  expect(result.endsWith('…')).toBe(true)
  expect(Array.from(result).length).toBeLessThanOrEqual(162)
})

test.each(['C++', '[配置]', '(参数)', '.*', '\\', 'a|b'])('excerpt matching treats %s literally', keyword => {
  const result = createSearchExcerpt(null, '开头 '.repeat(200) + keyword + ' 在这里', keyword)
  expect(result).toContain(keyword)
  expect(result.startsWith('…')).toBe(true)
})

test('matches English case insensitively while preserving the original text', () => {
  expect(createSearchExcerpt(null, '开头 '.repeat(100) + 'Using REACT for UI', 'react')).toContain('Using REACT for UI')
})

test('normalizes whitespace in the returned excerpt', () => {
  expect(createSearchExcerpt('  接口\n\t权限   校验  ', '正文', '权限')).toBe('接口 权限 校验')
})

test('falls back to a short summary for title-only or tag-only matches', () => {
  expect(createSearchExcerpt('文章介绍', '正文', '标签')).toBe('文章介绍')
})

test('falls back to the article when its summary is blank', () => {
  expect(createSearchExcerpt('  ', '正文介绍', '标题')).toBe('正文介绍')
})

test('keeps an entire long keyword inside the excerpt', () => {
  const keyword = '词'.repeat(100)
  expect(createSearchExcerpt(null, '前'.repeat(200) + keyword + '后'.repeat(200), keyword)).toContain(keyword)
})

test('does not split supplementary Unicode characters at the excerpt boundary', () => {
  const result = createSearchExcerpt(null, '😀'.repeat(300), '😀')
  expect(result).toBe('😀'.repeat(160) + '…')
})

test('handles an empty article without manufacturing content', () => {
  expect(createSearchExcerpt(null, '', '标题')).toBe('')
})

test('removes Markdown before truncation so long link URLs cannot consume the excerpt', () => {
  const content = '## **权限**说明\n\n[接口权限](https://example.com/' + 'a'.repeat(300) +
    ') 与 `权限`。\n\n```ts\nconst value = "权限";\n```\n\n![示意图](https://example.com/image.png)'
  expect(createSearchExcerpt(null, content, '权限')).toBe('权限说明 接口权限 与 权限。 const value = "权限"; 示意图')
})

test('ignores raw HTML and keeps decoded text, image labels and inline formatting', () => {
  const content = '权**限**与 <b>接口</b> &amp; 配置\n\n![流程图](https://example.com/a.png)\n\n<script>alert(1)</script>'
  expect(createSearchExcerpt(null, content, '权限')).toBe('权限与 接口 & 配置 流程图')
})

test('preserves literal code while removing code fences from a deep body match', () => {
  const content = '简介\n\n'.repeat(100) + '```cpp\nC++ <script> is code;\n```'
  const excerpt = createSearchExcerpt(null, content, 'C++')
  expect(excerpt).toContain('C++ <script> is code;')
  expect(excerpt).not.toContain('```')
  expect(excerpt).not.toContain('cpp')
})
