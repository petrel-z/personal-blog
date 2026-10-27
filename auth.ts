import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/server/db'
import bcrypt from 'bcryptjs'
import { runLoginAttempt } from '@/server/features/auth/login-attempt.service'
import { emailKey, normalizeEmail } from '@/server/features/auth/identity'
import { consumeCaptcha } from '@/server/features/auth/captcha.service'
import { registerMember, RegistrationError } from '@/server/features/auth/registration.service'
import { isSessionCurrent } from '@/server/features/auth/session-version.service'

class CaptchaError extends CredentialsSignin { code = 'captcha' }
class LoginLocked extends CredentialsSignin {
  constructor(seconds: number) { super(); this.code = `locked_${seconds}` }
}
class AuthUnavailable extends CredentialsSignin { code = 'unavailable' }
class RegistrationSignInError extends CredentialsSignin {
  constructor(reason: RegistrationError['reason']) { super(); this.code = `registration_${reason}` }
}
const dummyPasswordHash = bcrypt.hashSync('nonexistent-account-password', 10)

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        captchaId: { type: 'text' },
        captchaCode: { type: 'text' },
      },
      async authorize(credentials) {
        try {
          if (!await consumeCaptcha({ id: credentials?.captchaId as string, code: credentials?.captchaCode as string, purpose: 'login' })) {
            throw new CaptchaError()
          }
          if (typeof credentials?.email !== 'string' || typeof credentials?.password !== 'string' ||
              !credentials.email || credentials.email.length > 254 || !credentials.password || credentials.password.length > 1000) return null
          const email = normalizeEmail(credentials.email)
          const password = credentials.password
          const result = await runLoginAttempt(emailKey(email), async () => {
            const user = await prisma.user.findUnique({ where: { email } })
            const hashValid = !!user && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password)
            const valid = await bcrypt.compare(password, hashValid ? user!.password : dummyPasswordHash)
            if (!user || user.deletedAt || !hashValid || !valid) return null
            return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion }
          })
          if (result.kind === 'locked') throw new LoginLocked(result.retryAfterSeconds)
          return result.kind === 'success' ? result.user : null
        } catch (error) {
          if (error instanceof CredentialsSignin) throw error
          // Do not expose database diagnostics or submitted credentials to the client/logs.
          console.error('Authentication service unavailable')
          throw new AuthUnavailable()
        }
      },
    }),
    Credentials({
      id: 'registration',
      name: 'registration',
      credentials: {
        name: { type: 'text' },
        email: { type: 'email' },
        password: { type: 'password' },
        captchaId: { type: 'text' },
        captchaCode: { type: 'text' },
      },
      async authorize(credentials) {
        try {
          // Auth.js creates the session for this new account after registration succeeds.
          const user = await registerMember(credentials)
          return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion }
        } catch (error) {
          if (error instanceof RegistrationError) throw new RegistrationSignInError(error.reason)
          console.error('Registration service unavailable')
          throw new AuthUnavailable()
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.sessionVersion = user.sessionVersion
      }
      // Client update payloads never choose the version; compare the signed snapshot.
      return await isSessionCurrent(token.id, token.sessionVersion) ? token : null
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.sessionVersion = token.sessionVersion
      }
      return session
    },
  },
})
