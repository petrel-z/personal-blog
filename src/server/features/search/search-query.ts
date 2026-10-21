import { z } from 'zod'

// Prisma's MySQL pagination uses a signed 32-bit offset.
const MAX_OFFSET = 2_147_483_647

const positiveInteger = (fallback: number, maximum: number) => z.string()
  .regex(/^\d+$/, '分页参数必须为正整数')
  .transform(Number)
  .pipe(z.number().int().min(1).max(maximum))
  .default(String(fallback))

export const searchQuerySchema = z.object({
  keyword: z.string({ required_error: '请输入搜索关键词' })
    .trim().min(1, '请输入搜索关键词').max(100, '搜索关键词不能超过 100 个字符'),
  page: positiveInteger(1, MAX_OFFSET),
  pageSize: positiveInteger(10, 20),
}).refine(({ page, pageSize }) => (page - 1) * pageSize <= MAX_OFFSET, {
  path: ['page'], message: '分页偏移量过大',
})

export type SearchQuery = z.infer<typeof searchQuerySchema>
