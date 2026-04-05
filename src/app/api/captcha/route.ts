import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

// In production, use Redis to store captcha
// For now, we'll use a simple approach with response headers
const captchaStore = new Map<string, { code: string; expiresAt: number }>()

export async function GET() {
  const captchaId = nanoid(16)
  const code = nanoid(4).toUpperCase() // 4 character captcha
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

  // Store captcha
  captchaStore.set(captchaId, { code, expiresAt })

  // Clean expired captchas
  for (const [id, data] of Array.from(captchaStore.entries())) {
    if (data.expiresAt < Date.now()) {
      captchaStore.delete(id)
    }
  }

  // Generate simple SVG captcha
  const svg = generateCaptchaSvg(code)

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store',
      'X-Captcha-Id': captchaId,
    },
  })
}

export async function POST(request: Request) {
  try {
    const { captchaId, code } = await request.json()

    if (!captchaId || !code) {
      return NextResponse.json(
        { success: false, error: '缺少验证码参数' },
        { status: 400 }
      )
    }

    const stored = captchaStore.get(captchaId)

    if (!stored) {
      return NextResponse.json(
        { success: false, error: '验证码已过期' },
        { status: 400 }
      )
    }

    if (stored.expiresAt < Date.now()) {
      captchaStore.delete(captchaId)
      return NextResponse.json(
        { success: false, error: '验证码已过期' },
        { status: 400 }
      )
    }

    if (stored.code.toLowerCase() !== code.toLowerCase()) {
      captchaStore.delete(captchaId)
      return NextResponse.json(
        { success: false, error: '验证码错误' },
        { status: 400 }
      )
    }

    // Captcha verified, remove it
    captchaStore.delete(captchaId)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: '验证失败' },
      { status: 500 }
    )
  }
}

function generateCaptchaSvg(code: string): string {
  const width = 120
  const height = 40
  const fontSize = 28
  const charWidth = width / code.length

  // Generate random colors for each character
  const colors = code.split('').map(() => {
    const hue = Math.floor(Math.random() * 60) + 200 // Blue-ish colors
    return `hsl(${hue}, 70%, 40%)`
  })

  // Generate slight rotations
  const rotations = code.split('').map(() => {
    return (Math.random() - 0.5) * 0.4 // -0.2 to 0.2 radians
  })

  const chars = code.split('').map((char, i) => {
    const x = i * charWidth + charWidth / 2
    const y = height / 2 + fontSize / 3
    const transform = `rotate(${rotations[i]}rad, ${x}, ${y})`
    return `<text x="${x}" y="${y}" font-family="monospace" font-size="${fontSize}" fill="${colors[i]}" text-anchor="middle" transform="${transform}">${char}</text>`
  }).join('')

  // Add some noise lines
  const lines = Array.from({ length: 3 }, () => {
    const x1 = Math.random() * width
    const y1 = Math.random() * height
    const x2 = Math.random() * width
    const y2 = Math.random() * height
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1" opacity="0.2"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f0f4f8"/>
    ${lines}
    ${chars}
  </svg>`
}
