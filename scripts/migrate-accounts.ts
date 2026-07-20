import { PrismaClient } from '@prisma/client'

// Pre-push data migration for the Account/BillingAccount split (plan now
// lives on BillingAccount, shared by an owner and their invited team
// members, instead of being copied per-User at invite time).
//
// Runs BEFORE `prisma db push` — the BillingAccount table and the
// accountId/accountRole columns on User don't exist yet in the live
// database at this point, so everything here is raw SQL rather than typed
// Prisma Client calls. It creates those shapes itself (idempotently), then
// backfills every existing User with an accountId. `db push` (which runs
// right after this script) picks up from there: it adds the FK constraint,
// tightens accountId to NOT NULL, and drops the now-migrated plan/firmName
// columns from User — all safe once every row already has an accountId.
//
// Safe to re-run: every step is idempotent and only touches rows that still
// need it, so a re-deploy after a partial failure just picks up where it
// left off.

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "AccountRole" AS ENUM ('OWNER', 'MEMBER');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BillingAccount" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT,
      "plan" "Plan" NOT NULL DEFAULT 'NONE',
      "squareCustomerId" TEXT UNIQUE,
      "squareSubscriptionId" TEXT UNIQUE,
      "subscriptionStatus" TEXT,
      "currentPeriodEnd" TIMESTAMP(3),
      "pendingSquareOrderId" TEXT UNIQUE,
      "pendingSquarePlan" "Plan",
      "trialEndsAt" TIMESTAMP(3),
      "aiMonthlyBudgetCents" INTEGER,
      "chatbotEnabled" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Deployments that already ran an earlier version of this script have a
  // BillingAccount table with the old stripeCustomerId/stripeSubscriptionId
  // columns (from before the Square rename). `prisma db push` can't rename
  // them itself — it tries to DROP INDEX before DROP CONSTRAINT and Postgres
  // rejects that ordering — so drop the old unique columns here, explicitly
  // and idempotently, before push ever sees them. They're always NULL (no
  // payment integration ever went live under the old names), so there's
  // nothing to preserve.
  await prisma.$executeRawUnsafe(`ALTER TABLE "BillingAccount" DROP COLUMN IF EXISTS "stripeCustomerId"`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "BillingAccount" DROP COLUMN IF EXISTS "stripeSubscriptionId"`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "BillingAccount" ADD COLUMN IF NOT EXISTS "squareCustomerId" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "BillingAccount" ADD COLUMN IF NOT EXISTS "squareSubscriptionId" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "BillingAccount" ADD COLUMN IF NOT EXISTS "pendingSquareOrderId" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "BillingAccount" ADD COLUMN IF NOT EXISTS "pendingSquarePlan" "Plan"`)
  // Plain unique indexes (not named table constraints) — this is what Prisma
  // itself generates for `@unique` on Postgres, and IF NOT EXISTS makes this
  // trivially idempotent. An earlier ADD CONSTRAINT ... UNIQUE version of
  // this collided with an index Prisma had already half-created under the
  // same name (Postgres raises 42P07 "relation already exists" for that,
  // not 42710 "duplicate_object", so the old EXCEPTION WHEN duplicate_object
  // guard never caught it).
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BillingAccount_squareCustomerId_key" ON "BillingAccount" ("squareCustomerId")`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BillingAccount_squareSubscriptionId_key" ON "BillingAccount" ("squareSubscriptionId")`)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BillingAccount_pendingSquareOrderId_key" ON "BillingAccount" ("pendingSquareOrderId")`)

  // AiUsage.accountId (added when AI budget/usage moved from per-business to
  // per-account) is a required column with no sensible default, and `prisma
  // db push` refuses to add one of those to a non-empty table. These rows
  // are just this month's AI spend counters, not real business data, so
  // clearing them out — only if this table hasn't been migrated yet — is
  // far simpler than backfilling accountId via a join before businessId
  // disappears from the schema. Worst case: this month's spend tracker
  // resets to zero once.
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF to_regclass('"AiUsage"') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AiUsage' AND column_name = 'accountId'
      ) THEN
        TRUNCATE TABLE "AiUsage";
      END IF;
    END $$;
  `)

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountId" TEXT`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountRole" "AccountRole" NOT NULL DEFAULT 'MEMBER'`)

  const pending = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "User" WHERE "accountId" IS NULL`
  )
  if (Number(pending[0].count) === 0) {
    console.log('migrate-accounts: nothing to backfill')
    return
  }

  // 1. Every current business OWNER becomes the OWNER of their own new
  //    BillingAccount, seeded with their existing plan/firmName.
  const owners = await prisma.$queryRawUnsafe<{ id: string; plan: string; firmName: string | null }[]>(`
    SELECT DISTINCT u.id, u.plan, u."firmName"
    FROM "User" u
    INNER JOIN "BusinessUser" bu ON bu."userId" = u.id AND bu.role = 'OWNER'
    WHERE u."accountId" IS NULL
  `)
  for (const owner of owners) {
    const accountId = `acct_${owner.id}`
    await prisma.$executeRaw`
      INSERT INTO "BillingAccount" (id, name, plan, "updatedAt")
      VALUES (${accountId}, ${owner.firmName}, ${owner.plan}::"Plan", CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `
    await prisma.$executeRaw`
      UPDATE "User" SET "accountId" = ${accountId}, "accountRole" = 'OWNER' WHERE id = ${owner.id}
    `
  }
  console.log(`migrate-accounts: created ${owners.length} account(s) for business owners`)

  // 2. Users who don't own a business yet (fresh registrations, SUPERADMIN)
  //    still need their own account.
  const soloUsers = await prisma.$queryRawUnsafe<{ id: string; plan: string; firmName: string | null }[]>(`
    SELECT id, plan, "firmName" FROM "User"
    WHERE "accountId" IS NULL AND "accountType" IN ('ACCOUNTANT', 'SUPERADMIN')
  `)
  for (const u of soloUsers) {
    const accountId = `acct_${u.id}`
    await prisma.$executeRaw`
      INSERT INTO "BillingAccount" (id, name, plan, "updatedAt")
      VALUES (${accountId}, ${u.firmName}, ${u.plan}::"Plan", CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `
    await prisma.$executeRaw`
      UPDATE "User" SET "accountId" = ${accountId}, "accountRole" = 'OWNER' WHERE id = ${u.id}
    `
  }
  console.log(`migrate-accounts: created ${soloUsers.length} standalone account(s)`)

  // 3. Remaining users (invited TEAM_MEMBERs) inherit the account of
  //    whichever owner they share a business with — this is what actually
  //    fixes the plan-drift bug: from here on their plan is a live read of
  //    the owner's account, not a stale copy.
  const members = await prisma.$queryRawUnsafe<{ id: string; ownerAccountId: string }[]>(`
    SELECT DISTINCT ON (member.id) member.id, owner."accountId" AS "ownerAccountId"
    FROM "User" member
    INNER JOIN "BusinessUser" memberBu ON memberBu."userId" = member.id
    INNER JOIN "BusinessUser" ownerBu ON ownerBu."businessId" = memberBu."businessId" AND ownerBu.role = 'OWNER'
    INNER JOIN "User" owner ON owner.id = ownerBu."userId" AND owner."accountId" IS NOT NULL
    WHERE member."accountId" IS NULL
    ORDER BY member.id, ownerBu."createdAt" ASC
  `)
  for (const m of members) {
    await prisma.$executeRaw`
      UPDATE "User" SET "accountId" = ${m.ownerAccountId}, "accountRole" = 'MEMBER' WHERE id = ${m.id}
    `
  }
  console.log(`migrate-accounts: linked ${members.length} team member(s) to their owner's account`)

  // 4. Defensive fallback: anyone still unresolved (e.g. a business with no
  //    OWNER row) gets an individual account rather than being left broken
  //    ahead of the NOT NULL constraint `db push` is about to add.
  const stragglers = await prisma.$queryRawUnsafe<{ id: string; plan: string; firmName: string | null }[]>(`
    SELECT id, plan, "firmName" FROM "User" WHERE "accountId" IS NULL
  `)
  for (const u of stragglers) {
    const accountId = `acct_${u.id}`
    await prisma.$executeRaw`
      INSERT INTO "BillingAccount" (id, name, plan, "updatedAt")
      VALUES (${accountId}, ${u.firmName}, ${u.plan}::"Plan", CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `
    await prisma.$executeRaw`
      UPDATE "User" SET "accountId" = ${accountId}, "accountRole" = 'OWNER' WHERE id = ${u.id}
    `
  }
  if (stragglers.length > 0) {
    console.warn(
      `migrate-accounts: WARNING - ${stragglers.length} user(s) had no owner/business to inherit from and got a fallback individual account: ${stragglers.map(s => s.id).join(', ')}`
    )
  }
}

main()
  .catch((e) => {
    console.error('migrate-accounts FAILED:', e?.message ?? e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
