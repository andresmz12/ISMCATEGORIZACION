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
const NEW_PASSWORD = process.env.NEW_PASSWORD

async function main() {
  if (!NEW_PASSWORD) {
    console.error('❌ NEW_PASSWORD env var is required — refusing to fall back to a hardcoded password.')
    console.error('   Usage: NEW_PASSWORD="MiNuevaContraseña123!" npx tsx scripts/reset-superadmin.ts')
    process.exitCode = 1
    return
  }

  const hash = await bcrypt.hash(NEW_PASSWORD, 12)
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash: hash, isActive: true },
    create: {
      email: EMAIL,
      passwordHash: hash,
      name: 'Super Admin',
      accountType: 'SUPERADMIN',
      accountRole: 'OWNER',
      isActive: true,
      billingAccount: { create: { plan: 'ENTERPRISE' } },
    },
  })

  await prisma.auditLog.create({
    data: { userId: user.id, action: 'SUPERADMIN_PASSWORD_RESET_VIA_SCRIPT', entity: 'User', entityId: user.id },
  }).catch(() => {})

  console.log(`✅ Password reset for ${user.email}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
