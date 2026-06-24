'use server'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import { PrismaClient } from '@prisma/client'

const cuid = customAlphabet('36ghjkmnpqrtvwxyz2468', 24)

export async function resetPassword(
  secret: string,
  email: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  const db = new PrismaClient()
  try {
    const resetSecret = process.env.ADMIN_RESET_SECRET
    if (!resetSecret) {
      return { ok: false, message: 'ADMIN_RESET_SECRET no está configurado en Railway' }
    }
    if (secret !== resetSecret) {
      return { ok: false, message: 'Secret incorrecto' }
    }
    if (!email || !newPassword || newPassword.length < 8) {
      return { ok: false, message: 'Email y contraseña (mín. 8 caracteres) requeridos' }
    }

    const normalizedEmail = email.toLowerCase().trim()
    const hash = await bcrypt.hash(newPassword, 12)

    // Use raw SQL to avoid schema validation issues with missing teamOwnerId column
    const existing = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE email = ${normalizedEmail}
    `

    if (existing.length === 0) {
      await db.$executeRaw`
        INSERT INTO "User" (id, email, "passwordHash", name, "accountType", plan, "isActive", "createdAt", "updatedAt")
        VALUES (${cuid()}, ${normalizedEmail}, ${hash}, 'Super Admin', 'SUPERADMIN', 'ENTERPRISE', true, NOW(), NOW())
      `
      return { ok: true, message: `Usuario creado: ${normalizedEmail}` }
    }

    await db.$executeRaw`
      UPDATE "User" SET "passwordHash" = ${hash}, "isActive" = true, "updatedAt" = NOW()
      WHERE email = ${normalizedEmail}
    `
    return { ok: true, message: `✓ Contraseña actualizada para ${normalizedEmail}` }
  } catch (e: any) {
    return { ok: false, message: `Error DB: ${e?.message ?? String(e)}` }
  } finally {
    await db.$disconnect()
  }
}
