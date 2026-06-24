'use server'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

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

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } })

    if (!existing) {
      await db.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: hash,
          name: 'Super Admin',
          accountType: 'SUPERADMIN' as any,
          plan: 'ENTERPRISE' as any,
          isActive: true,
        },
      })
      return { ok: true, message: `Usuario creado: ${normalizedEmail}` }
    }

    await db.user.update({
      where: { email: normalizedEmail },
      data: { passwordHash: hash, isActive: true },
    })
    return { ok: true, message: `✓ Contraseña actualizada para ${normalizedEmail}` }
  } catch (e: any) {
    return { ok: false, message: `Error DB: ${e?.message ?? String(e)}` }
  } finally {
    await db.$disconnect()
  }
}
