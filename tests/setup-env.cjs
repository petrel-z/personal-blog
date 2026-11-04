// Unit tests must not depend on a developer's .env or production credentials.
process.env.AUTH_SECRET = 'unit-test-only-auth-secret-at-least-32-bytes'
process.env.NEXTAUTH_SECRET = ''
