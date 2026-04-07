export const siteConfig = {
  name: 'Petrel Blog',
  description: 'A personal tech blog',
  url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  author: 'tl.s',
  social: {
    github: 'https://github.com/Petrel',
    twitter: 'https://twitter.com/Petrel',
  },
}

export const seoConfig = {
  titleTemplate: '%s | Petrel Blog',
  defaultTitle: 'Petrel Blog',
  defaultDescription: 'A personal tech blog',
  ogImage: '/og-image.png',
}
