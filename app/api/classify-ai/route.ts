import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import { requirePlanFeature } from '@/lib/plan-limits'
import { checkAiBudget, recordAiUsage } from '@/lib/ai-budget'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = requirePlanFeature(session, 'aiClassify')
  if (denied) return denied

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  // 20 classification jobs per user per hour to prevent AI API abuse
  const rl = rateLimit(`classify:${userId}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

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
    const budgetDenied = await checkAiBudget(businessId)
    if (budgetDenied) return budgetDenied

    const transactions = await prisma.transaction.findMany({
      where: { id: { in: transactionIds }, businessId, status: 'PENDING' },
    })
    if (!transactions.length) return NextResponse.json({ classified: [], skipped: transactionIds.length })

    // Load all categories available to this business (system + custom)
    const categories = await prisma.category.findMany({
      where: { OR: [{ isSystem: true }, { businessId }] },
      select: { id: true, name: true },
    })
    const categoryMap = new Map(categories.map((c: { name: string; id: string }) => [c.name.toLowerCase().trim(), c.id]))
    const categoryNames = categories.map((c: { name: string }) => c.name)
    const uncategorizedId = categories.find((c: { name: string }) => c.name.toLowerCase().includes('uncategor') || c.name.toLowerCase().includes('sin categor'))?.id

    // Build dynamic prompt with the actual category names from DB
    const dynamicPrompt = `You are an expert accountant specializing in expense categorization for small businesses.

Given a list of bank transactions, classify each one into the most appropriate category from this exact list:
${categoryNames.map((n: string) => `- ${n}`).join('\n')}

For each transaction, return:
- category: must be EXACTLY one of the category names listed above (copy it verbatim)
- deductibility: "YES" (100% deductible), "NO" (not deductible), or "FIFTY" (50% deductible, for meals)
- confidence: "HIGH" (very clear), "MEDIUM" (likely), or "LOW" (uncertain)
- reason: brief explanation (one sentence)

Respond with a JSON array matching the input order. Use only category names from the list above.`

    // Process in batches of 20
    const BATCH = 20
    const results: any[] = []
    const warnings: string[] = []

    for (let i = 0; i < transactions.length; i += BATCH) {
      if (i > 0 && await checkAiBudget(businessId)) {
        warnings.push(`Se alcanzó el presupuesto mensual de IA — ${transactions.length - i} transacciones restantes fueron omitidas`)
        break
      }

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
        system: dynamicPrompt,
      })
      await recordAiUsage(businessId, response.usage.input_tokens, response.usage.output_tokens)

      let classifications: any[] = []
      try {
        const firstBlock = response.content?.[0]
        const text = firstBlock?.type === 'text' ? firstBlock.text : ''
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('no JSON array in response')
        classifications = JSON.parse(jsonMatch[0])
      } catch (parseErr) {
        console.error(`classify-ai: batch ${i / BATCH} JSON parse failed, skipping batch`, parseErr)
        warnings.push(`Batch ${Math.floor(i / BATCH) + 1} failed to parse — ${batch.length} transactions were skipped`)
        continue
      }

      for (let j = 0; j < batch.length; j++) {
        const tx = batch[j]
        const cls = classifications[j]
        if (!cls) continue

        const categoryId = categoryMap.get(cls.category?.toLowerCase().trim()) ?? uncategorizedId
        if (!categoryId) continue // no categories in DB, skip

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
    return NextResponse.json({ classified: results, autoClassified, needsReview, ...(warnings.length ? { warnings } : {}) })
  } catch (e: any) {
    console.error('classify-ai error:', e)
    return NextResponse.json({ error: 'Error al clasificar transacciones' }, { status: 500 })
  }
}
