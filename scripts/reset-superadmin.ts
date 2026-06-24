/**
 * Run from Railway terminal:
 *   npx tsx scripts/reset-superadmin.ts
 *
 * Or with a custom password:
 *   NEW_PASSWORD="MiNuevaContraseña123!" npx tsx scripts/reset-superadmin.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const EMAIL = 'superadmin@mypnl.com'
const NEW_PASSWORD = process.env.NEW_PASSWORD || 'SuperAdmin123!'

async function main() {
  const hash = await bcrypt.hash(NEW_PASSWORD, 12)
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash: hash, isActive: true },
    create: {
      email: EMAIL,
      passwordHash: hash,
      name: 'Super Admin',
      accountType: 'SUPERADMIN',
      plan: 'ENTERPRISE',
      isActive: true,
    },
  })
  console.log(`✅ Password reset for ${user.email}`)
  console.log(`   New password: ${NEW_PASSWORD}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
