import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { requirePlanFeature } from '@/lib/plan-limits'
import { checkAiBudget, recordAiUsage } from '@/lib/ai-budget'

// Classifies raw transaction rows with AI WITHOUT saving to DB.
// Returns classified rows so the user can review before committing.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const denied = requirePlanFeature(session, 'aiClassify')
  if (denied) return denied

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const rl = rateLimit(`classify-preview:${userId}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const { businessId, rows } = await req.json()
    if (!businessId || !Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ error: 'businessId and rows required' }, { status: 400 })
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: 'Max 500 rows per request' }, { status: 400 })
    }
    if (!await checkBusinessAccess(userId, businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const budgetDenied = await checkAiBudget(businessId)
    if (budgetDenied) return budgetDenied

    // Load actual categories for this business
    const categories = await prisma.category.findMany({
      where: { OR: [{ isSystem: true }, { businessId }] },
      select: { id: true, name: true },
    })
    const categoryByName = new Map(categories.map(c => [c.name.toLowerCase().trim(), c]))
    const categoryNames = categories.map(c => c.name)
    const uncategorized = categories.find(c => c.name.toLowerCase().includes('uncategor') || c.name.toLowerCase().includes('sin categor'))

    const prompt = `You are an expert accountant specializing in expense categorization for small businesses.

Given a list of bank transactions, classify each one into the most appropriate category from this exact list:
${categoryNames.map(n => `- ${n}`).join('\n')}

For each transaction, return:
- category: must be EXACTLY one of the category names listed above (copy it verbatim)
- deductibility: "YES" (100% deductible), "NO" (not deductible), or "FIFTY" (50% deductible, for meals)
- confidence: "HIGH" (very clear), "MEDIUM" (likely), or "LOW" (uncertain)
- reason: brief explanation (one sentence)

Respond with a JSON array matching the input order. Use only category names from the list above.`

    const BATCH = 20
    const results: any[] = []
    const warnings: string[] = []

    for (let i = 0; i < rows.length; i += BATCH) {
      if (i > 0 && await checkAiBudget(businessId)) {
        warnings.push(`Se alcanzó el presupuesto mensual de IA — ${rows.length - i} filas restantes no fueron clasificadas`)
        break
      }

      const batch = rows.slice(i, i + BATCH)
      const txList = batch.map((t: any, idx: number) => ({
        index: idx,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
      }))

      let classifications: any[] = []
      try {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: prompt,
          messages: [{
            role: 'user',
            content: `Classify these ${batch.length} transactions:\n\n${JSON.stringify(txList, null, 2)}\n\nReturn a JSON array with ${batch.length} objects.`,
          }],
        })
        await recordAiUsage(businessId, response.usage.input_tokens, response.usage.output_tokens)
        const text = response.content?.[0]?.type === 'text' ? response.content[0].text : ''
        const match = text.match(/\[[\s\S]*\]/)
        if (match) classifications = JSON.parse(match[0])
      } catch (e) {
        console.error('classify-preview: batch parse error', e)
      }

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j]
        const cls = classifications[j] || {}
        const matched = categoryByName.get(cls.category?.toLowerCase().trim() || '')
        const cat = matched || uncategorized || null

        results.push({
          // original row data
          date: row.date,
          description: row.description,
          amount: row.amount,
          type: row.type,
          // AI classification
          categoryId: cat?.id || null,
          categoryName: cat?.name || null,
          aiSuggestion: cls.category || null,
          deductibility: cls.deductibility || 'NO',
          aiConfidence: cls.confidence || 'LOW',
          reason: cls.reason || null,
        })
      }
    }

    return NextResponse.json({ results, ...(warnings.length ? { warnings } : {}) })
  } catch (e: any) {
    console.error('classify-preview error:', e)
    return NextResponse.json({ error: 'Error al clasificar' }, { status: 500 })
  }
}
