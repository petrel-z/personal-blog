export const APP_NAME = 'Frytea Blog'
export const APP_DESCRIPTION = 'A personal tech blog'

// Pagination
export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 50

// Post
export const POST_TITLE_MIN_LENGTH = 1
export const POST_TITLE_MAX_LENGTH = 200
export const POST_CONTENT_MIN_LENGTH = 1
export const SUMMARY_MAX_LENGTH = 500
export const WORDS_PER_MINUTE = 300

// Comment
export const COMMENT_NICKNAME_MIN_LENGTH = 1
export const COMMENT_NICKNAME_MAX_LENGTH = 20
export const COMMENT_CONTENT_MAX_LENGTH = 500
export const COMMENT_RATE_LIMIT_WINDOW = 60 // seconds
export const COMMENT_RATE_LIMIT_MAX = 1 // max comments per window

// Like
export const VIEW_COUNT_WINDOW = 600 // seconds (10 minutes)

// Login
export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_LOCKOUT_WINDOW = 900 // seconds (15 minutes)
export const SESSION_MAX_AGE = 24 * 60 * 60 // seconds (24 hours)

// Validation
export const CAPTCHA_LENGTH = 4
export const CAPTCHA_EXPIRY = 5 * 60 // seconds (5 minutes)

// File upload
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
export const IMAGE_QUALITY = 0.8
