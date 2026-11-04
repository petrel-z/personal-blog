import { getPostLoginPath } from '@/shared/permissions'

test('a reader without dashboard permission lands on posts', () => {
  expect(getPostLoginPath(['post:read'])).toBe('/admin/posts')
})
test('accounts without management permissions get an explicit denied page', () => {
  expect(getPostLoginPath([])).toBe('/forbidden')
})
test.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/admin/users', '/admin/posts/../users', '/admin/posts/%2e%2e/users'])('rejects unsafe or unauthorized destination %s', url => {
  expect(getPostLoginPath(['post:read'], url)).toBe('/admin/posts')
})
test('keeps an authorized post destination and query', () => {
  expect(getPostLoginPath(['post:read'], '/admin/posts/article-1?mode=edit')).toBe('/admin/posts/article-1?mode=edit')
})
