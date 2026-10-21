import { splitSearchHighlight } from '@/shared/search-highlight'

test('highlights every Chinese match without losing surrounding text', () => {
  expect(splitSearchHighlight('权限与接口权限。', '权限')).toEqual([
    { text: '权限', matched: true }, { text: '与接口', matched: false },
    { text: '权限', matched: true }, { text: '。', matched: false },
  ])
})

test('matches case insensitively and preserves the original spelling', () => {
  expect(splitSearchHighlight('React / REACT', 'react')).toEqual([
    { text: 'React', matched: true }, { text: ' / ', matched: false }, { text: 'REACT', matched: true },
  ])
})

test.each(['C++', '[配置]', '.*', '\\', 'a|b', '(参数)'])('treats %s as a literal keyword', keyword => {
  expect(splitSearchHighlight(`前${keyword}后`, keyword)).toEqual([
    { text: '前', matched: false }, { text: keyword, matched: true }, { text: '后', matched: false },
  ])
})

test('normalizes outer whitespace and preserves emoji', () => {
  expect(splitSearchHighlight('😀😀！', ' 😀 ')).toEqual([
    { text: '😀', matched: true }, { text: '😀', matched: true }, { text: '！', matched: false },
  ])
})

test.each(['', '   ', '未命中'])('leaves text intact for an empty or missing match: %s', keyword => {
  expect(splitSearchHighlight('普通文章', keyword)).toEqual([{ text: '普通文章', matched: false }])
})
