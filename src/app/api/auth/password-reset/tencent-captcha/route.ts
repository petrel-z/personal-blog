import { NextResponse } from 'next/server'
import { ApiCode, error as apiError, success } from '@/lib/api-response'
import { getClientIp } from '@/server/lib/request'
import { captcha } from 'tencentcloud-sdk-nodejs-captcha';

const CaptchaClient = captcha.v20190722.Client;

export const runtime = 'nodejs'

const client = new CaptchaClient({
    credential: {
        secretId: process.env.TENCENT_SECRET_ID!,
        secretKey: process.env.TENCENT_SECRET_KEY!,
    },
    region: 'ap-guangzhou',
});

export async function POST(request: Request) {
    const { ticket, randstr } = await request.json()
    if (!ticket || !randstr) {
        return NextResponse.json(apiError(ApiCode.BAD_REQUEST, '验证码参数缺失'), { status: 400 })
    }
    try {
        const res = await client.DescribeCaptchaResult({
            Ticket: ticket,
            Randstr: randstr,
            UserIp: getClientIp(request) === '::1' ? '127.0.0.1' : getClientIp(request) || '',
            CaptchaType: 9,
            CaptchaAppId: Number(process.env.NEXT_PUBLIC_CAPTCHA_APP_ID),
            AppSecretKey: process.env.APP_SCRECT_KEY || '',
        })

        if (res.CaptchaCode !== 1) {
            return NextResponse.json(apiError(ApiCode.BAD_REQUEST, '人机校验失败: ' + (res.response || '未知错误')), { status: 400 })
        }
        return NextResponse.json(success({ message: '人机校验成功' }))

    } catch (error) {
        console.error('Tencent captcha validation failed', error)
        return NextResponse.json(apiError(ApiCode.SERVICE_UNAVAILABLE, '验证码验证服务暂时不可用'), { status: 503 })
    }
}