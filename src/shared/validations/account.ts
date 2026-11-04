import { z } from 'zod'

export const accountSchema = z.object({
  name: z.string().trim().min(1, '用户名不能为空').max(50, '用户名不能超过50字符'),
  email: z.string().trim().email('邮箱格式无效').max(254, '邮箱不能超过254字符').transform(value => value.toLowerCase()),
  password: z.string().min(6, '密码至少6位').refine(value => new TextEncoder().encode(value).length <= 72, {
    message: '密码不能超过72字节（中文和表情可能占多个字节）',
  }),
})

export const managedUserSchema = accountSchema.extend({
  roleIds: z.array(z.string().min(1).max(191)).min(1, '请至少选择一个角色').max(4, '最多选择四个角色')
    .refine(ids => new Set(ids).size === ids.length, '角色不能重复'),
})

export type ManagedUserInput = z.infer<typeof managedUserSchema>

export const managedUserFormSchema = managedUserSchema.extend({
  confirmPassword: z.string().min(1, '请确认密码'),
}).refine(data => data.password === data.confirmPassword, {
  message: '两次密码不一致', path: ['confirmPassword'],
})
export type ManagedUserFormInput = z.infer<typeof managedUserFormSchema>
