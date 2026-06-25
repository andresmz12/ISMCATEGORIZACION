import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert US tax accountant specializing in IRS Schedule C expense categorization for small businesses.

Given a list of bank transactions, classify each one into the most appropriate IRS Schedule C category.

Available categories:
- Advertising (Schedule C Line 8): marketing, ads, promotions, social media ads
- Car & Truck Expenses (Line 9): gas, auto insurance, vehicle maintenance
- Commissions & Fees (Line 10): sales commissions, referral fees, platform fees
- Contract Labor (Line 11): freelancers, independent contractors, 1099 workers
- Depreciation (Line 13): equipment depreciation
- Employee Benefits (Line 14): health insurance, retirement contributions for employees
- Insurance (Line 15): business liability, property insurance (not auto)
- Interest - Other (Line 16b): loan interest, credit card interest
- Legal & Professional (Line 17): lawyers, accountants, consultants, software subscriptions for business
- Office Expenses (Line 18): office supplies, printer ink, postage, software
- Rent - Other (Line 20b): office rent, storage units
- Repairs & Maintenance (Line 21): equipment repair, building maintenance
- Supplies (Line 22): materials used in business operations
- Taxes & Licenses (Line 23): business licenses, state taxes, payroll taxes
- Travel (Line 24a): airfare, hotels for business travel
- Meals (50%) (Line 24b): business meals, client entertainment
- Utilities (Line 25): electricity, internet, phone, water
- Wages (Line 26): payroll, employee salaries
- Other Expenses (Line 27a): miscellaneous deductible expenses
- Business Income (Line 1): revenue, sales, deposits that are income
- Owner Draw / Personal: personal expenses, transfers to personal accounts
- Transfer: transfers between accounts, payments to self
- Uncategorized: unclear, need more info

For each transaction, return:
- category: the exact category name from the list above
- deductibility: "YES" (100% deductible), "NO" (not deductible), or "FIFTY" (50% deductible, for meals)
- confidence: "HIGH" (very clear), "MEDIUM" (likely), or "LOW" (uncertain)
- reason: brief explanation (one sentence)

Respond with a JSON array matching the input order.`

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  // 20 classification jobs per user per hour to prevent AI API abuse
  const rl = rateLimit(`classify:${userId}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  try {
    const { businessId, transactionIds } = await req.json()
    if (!businessId || !transactionIds?.length) {
      return NextResponse.json({ error: 'businessId and transactionIds required' }, { status: 400 })
    }
    if (!Array.isArray(transactionIds) || transactionIds.length > 500) {
      return NextResponse.json({ error: 'transactionIds must be an array of at most 500 items' }, { status: 400 })
    }
    if (!await checkBusinessAccess(userId, businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const transactions = await prisma.transaction.findMany({
      where: { id: { in: transactionIds }, businessId, status: 'PENDING' },
    })
    if (!transactions.length) return NextResponse.json({ classified: [], skipped: transactionIds.length })

    const categories = await prisma.category.findMany({ where: { isSystem: true } })
    const categoryMap = new Map(categories.map((c: { name: string; id: string }) => [c.name, c.id]))

    // Process in batches of 20
    const BATCH = 20
    const results: any[] = []

    for (let i = 0; i < transactions.length; i += BATCH) {
      const batch = transactions.slice(i, i + BATCH)
      const txList = batch.map((t: any, idx: number) => ({
        index: idx,
        date: t.date.toISOString().split('T')[0],
        description: t.description,
        amount: t.amount,
        type: t.type,
      }))

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Classify these ${batch.length} transactions:\n\n${JSON.stringify(txList, null, 2)}\n\nReturn a JSON array with ${batch.length} objects.`,
          },
        ],
        system: SYSTEM_PROMPT,
      })

      let classifications: any[] = []
      try {
        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('no JSON array in response')
        classifications = JSON.parse(jsonMatch[0])
      } catch (parseErr) {
        console.error(`classify-ai: batch ${i / BATCH} JSON parse failed, skipping batch`, parseErr)
        continue
      }

      for (let j = 0; j < batch.length; j++) {
        const tx = batch[j]
        const cls = classifications[j]
        if (!cls) continue

        const uncategorizedId = categoryMap.get('Uncategorized')
        const categoryId = categoryMap.get(cls.category) ?? uncategorizedId
        if (!categoryId) continue // no system categories in DB, skip

        const confidence = cls.confidence || 'LOW'

        const updateData: any = {
          aiConfidence: confidence,
          aiSuggestion: cls.category,
          method: 'AI',
          categoryId,
          deductibility: cls.deductibility || 'NO',
          status: confidence === 'HIGH' ? 'CLASSIFIED' : 'NEEDS_REVIEW',
        }

        await prisma.transaction.update({ where: { id: tx.id }, data: updateData })
        results.push({ id: tx.id, ...cls, autoClassified: confidence === 'HIGH' })
      }
    }

    const autoClassified = results.filter(r => r.autoClassified).length
    const needsReview = results.filter(r => !r.autoClassified).length
    await logAudit({ userId, businessId, action: 'CLASSIFY_TRANSACTIONS', entity: 'Transaction', metadata: { total: results.length, autoClassified, needsReview } })
    return NextResponse.json({ classified: results, autoClassified, needsReview })
  } catch (e: any) {
    console.error('classify-ai error:', e)
    return NextResponse.json({ error: 'Error al clasificar transacciones' }, { status: 500 })
  }
}
