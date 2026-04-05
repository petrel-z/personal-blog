export const siteConfig = {
  name: 'Frytea Blog',
  description: 'A personal tech blog',
  url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  author: 'tl.s',
  social: {
    github: 'https://github.com/frytea',
    twitter: 'https://twitter.com/frytea',
  },
}

export const seoConfig = {
  titleTemplate: '%s | Frytea Blog',
  defaultTitle: 'Frytea Blog',
  defaultDescription: 'A personal tech blog',
  ogImage: '/og-image.png',
}
