import { prisma } from '@/lib/prisma'

export async function logAudit(params: {
  userId: string
  businessId?: string | null
  action: string
  entity?: string
  entityId?: string
  metadata?: object
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        businessId: params.businessId ?? null,
        action: params.action,
        entity: params.entity ?? null,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? undefined,
      },
    })
  } catch {
    // Never block the main flow
  }
}
