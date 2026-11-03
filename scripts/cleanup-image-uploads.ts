import { prisma } from '../src/server/db'
import { cleanupImageUploads } from '../src/server/features/upload/upload.service'

async function main() {
  let total = 0
  let batch: number
  do { batch = await cleanupImageUploads(); total += batch } while (batch === 100)
  console.log(`Cleaned ${total} expired image upload tasks.`)
}

main().catch(() => { console.error('Image upload cleanup failed.'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
