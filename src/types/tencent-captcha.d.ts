export {}

declare global {
    interface Window {
        TencentCaptcha: new (
            appid: string,
            callback: (res: any) => void,
            options?: Record<string, any>
        ) => {
            show: () => void;
            destroy: () => void;
            getTicket: () => { CaptchaAppId: string; ticket: string };
        };
    }
}