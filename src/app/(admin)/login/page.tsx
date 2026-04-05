export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 border rounded-lg bg-card">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">管理后台登录</h1>
          <p className="text-sm text-muted-foreground">
            请输入管理员账号信息
          </p>
        </div>

        <form className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              placeholder="admin@example.com"
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              密码
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="captcha" className="text-sm font-medium">
              验证码
            </label>
            <div className="flex gap-2">
              <input
                id="captcha"
                type="text"
                placeholder="4位验证码"
                className="flex-1 px-3 py-2 border rounded-lg bg-background"
              />
              <div className="px-4 py-2 bg-primary/10 text-primary font-mono font-bold rounded-lg cursor-pointer hover:bg-primary/20">
                A7B9
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  )
}
