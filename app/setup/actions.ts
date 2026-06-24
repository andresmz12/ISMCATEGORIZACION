'use server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function resetPassword(
  secret: string,
  email: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
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
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  if (!user) {
    // Create superadmin if doesn't exist
    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hash,
        name: 'Super Admin',
        accountType: 'SUPERADMIN',
        plan: 'ENTERPRISE',
        isActive: true,
      },
    })
    return { ok: true, message: `Usuario creado: ${normalizedEmail}` }
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { email: normalizedEmail },
    data: { passwordHash: hash, isActive: true },
  })
  return { ok: true, message: `Contraseña actualizada para ${normalizedEmail}` }
}
