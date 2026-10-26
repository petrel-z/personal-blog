import type { MailContent } from './types'

export function buildResetCodeMail(code: string): MailContent {
  if (typeof code !== 'string' || code.length !== 6 || !/^[0-9]{6}$/.test(code)) {
    throw new Error('验证码必须为6位数字')
  }
  return {
    subject: '密码重置验证码',
    text: `您正在申请重置博客账号的密码。\n\n验证码：${code}\n\n验证码将在 10 分钟后失效，请尽快完成操作。请勿将验证码告诉他人。\n如果这不是您本人的操作，请忽略此邮件，您的密码不会改变。`,
    html: `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>密码重置验证码</title></head>
<body style="margin:0;padding:32px 16px;background:#f5f5f4;font-family:Arial,sans-serif;color:#292524">
  <table role="presentation" style="width:100%;max-width:520px;margin:0 auto;border-collapse:collapse;background:#fff;border:1px solid #e7e5e4">
    <tr><td style="padding:32px">
      <h1 style="margin:0 0 20px;font-size:22px">重置密码</h1>
      <p style="font-size:15px;line-height:1.8">您正在申请重置博客账号的密码，请在页面中输入以下验证码：</p>
      <p style="padding:20px;text-align:center;background:#fafaf9;font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p>
      <p style="font-size:15px;line-height:1.8">验证码将在 <strong>10 分钟</strong>后失效，请尽快完成操作。请勿将验证码告诉他人。</p>
      <p style="margin-top:24px;font-size:13px;line-height:1.8;color:#78716c">如果这不是您本人的操作，请忽略此邮件，您的密码不会改变。</p>
    </td></tr>
  </table>
</body></html>`,
  }
}
