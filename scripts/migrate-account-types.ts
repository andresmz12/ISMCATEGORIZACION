import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const count = await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "accountType" = 'ACCOUNTANT' WHERE "accountType"::text = 'INDIVIDUAL'`
    )
    console.log(`migrate-account-types: migrated ${count} INDIVIDUAL users to ACCOUNTANT`)
  } catch (e: any) {
    console.log('migrate-account-types skipped:', e?.message ?? e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
