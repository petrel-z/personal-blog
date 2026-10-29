import { useCallback, useState } from 'react'

interface TencentCaptchRes {
    ret: number;
    ticket: string;
    randstr: string;
}

export function useTencentCaptcha() {
    const appid = process.env.NEXT_PUBLIC_CAPTCHA_APP_ID || "";

    const  openCaptcha = useCallback(() => {
        return new Promise<TencentCaptchRes>((resolve, reject) => {
            if (typeof window.TencentCaptcha !== 'function') {
                console.error('验证码脚本尚未加载，请稍后重试')
                return
            }
            const captch = new window.TencentCaptcha(appid, (res: TencentCaptchRes) => {
                if (res.ret === 0) {
                    console.log("Captcha success", res);
                    resolve({ticket: res.ticket, randstr: res.randstr, ret: res.ret})
                }else {
                    reject(new Error(`Captcha failed with ret code: ${res.ret}`))
                }
            }, {})
            captch.show();
        })
    }, [appid])

    return {
        openCaptcha
    }
}