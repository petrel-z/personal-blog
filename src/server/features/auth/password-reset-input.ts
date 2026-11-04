import { isIP } from 'node:net'
import { z } from 'zod'

// Match equivalent IPv6 spellings and group invalid/unavailable sources together.
export const resetIpSchema = z.string().max(64).transform(value => isIP(value) === 6 && !value.includes('%')
  ? new URL(`http://[${value}]/`).hostname.slice(1, -1) : isIP(value) === 4 ? value : 'unknown')
