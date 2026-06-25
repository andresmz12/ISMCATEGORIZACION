import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORIES = [
  'Advertising', 'Car & Truck Expenses', 'Commissions & Fees', 'Contract Labor',
  'Insurance', 'Interest - Other', 'Legal & Professional', 'Office Expenses',
  'Rent - Other', 'Repairs & Maintenance', 'Supplies', 'Taxes & Licenses',
  'Travel', 'Meals (50%)', 'Utilities', 'Wages', 'Other Expenses',
  'Cost of Goods Sold', 'Business Income', 'Owner Draw / Personal', 'Uncategorized',
]

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  // 30 receipt scans per user per hour to prevent AI API abuse
  const rl = rateLimit(`receipt-scan:${userId}`, 30, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
  }

  try {
    const formData = await req.formData()
    const businessId = formData.get('businessId') as string
    const file = formData.get('file') as File
    if (!businessId || !file) return NextResponse.json({ error: 'businessId and file required' }, { status: 400 })

    if (!await checkBusinessAccess(userId, businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })
    }

    const base64Data = buffer.toString('base64')
    const rawMime = file.type || 'image/jpeg'
    const isPdf = rawMime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

    // Normalize mime for Claude: heic/heif → jpeg
    let claudeMime: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf' = 'image/jpeg'
    if (isPdf) claudeMime = 'application/pdf'
    else if (rawMime === 'image/png') claudeMime = 'image/png'
    else if (rawMime === 'image/webp') claudeMime = 'image/webp'
    else if (rawMime === 'image/gif') claudeMime = 'image/gif'

    const imageContent: any = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
      : { type: 'image', source: { type: 'base64', media_type: claudeMime, data: base64Data } }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          imageContent,
          {
            type: 'text',
            text: `Analyze this receipt and return ONLY a JSON object (no markdown, no backticks, no explanation):
{
  "merchant": "store or merchant name",
  "date": "YYYY-MM-DD or null",
  "total": 0.00,
  "subtotal": 0.00,
  "tax": 0.00,
  "items": [{"description": "item", "amount": 0.00}],
  "payment_method": "cash/credit/debit/other or null",
  "category_suggestion": "one of: ${CATEGORIES.join(', ')}",
  "deductibility": "YES/NO/FIFTY",
  "confidence": "HIGH/MEDIUM/LOW"
}
Use null for any field you cannot read. Receipt may be in English or Spanish.`,
          },
        ],
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    let extracted: any = {}
    try {
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) extracted = JSON.parse(m[0])
    } catch {
      extracted = { confidence: 'LOW' }
    }

    // Resolve category
    const categories = await prisma.category.findMany({ where: { isSystem: true } })
    const catMap = new Map(categories.map((c: any) => [c.name, c.id]))
    const categoryId = catMap.get(extracted.category_suggestion) ?? catMap.get('Uncategorized') ?? null

    const confidence: string = extracted.confidence || 'LOW'
    const txStatus = confidence === 'HIGH' && categoryId ? 'CLASSIFIED' : 'PENDING'
    const amount = Math.abs(parseFloat(String(extracted.total)) || 0)
    const rawDate = extracted.date ? new Date(extracted.date) : null
    const txDate = rawDate && !isNaN(rawDate.getTime()) ? rawDate : new Date()

    const notesLines: string[] = []
    if (extracted.subtotal) notesLines.push(`Subtotal: $${extracted.subtotal}`)
    if (extracted.tax) notesLines.push(`Tax: $${extracted.tax}`)
    if (Array.isArray(extracted.items) && extracted.items.length > 0) {
      extracted.items.forEach((it: any) => notesLines.push(`• ${it.description}: $${it.amount}`))
    }
    if (extracted.payment_method) notesLines.push(`Payment: ${extracted.payment_method}`)

    const transaction = await prisma.transaction.create({
      data: {
        businessId,
        date: txDate,
        description: extracted.merchant || file.name,
        amount,
        type: 'DEBIT',
        status: txStatus as any,
        categoryId: txStatus === 'CLASSIFIED' ? categoryId : undefined,
        deductibility: (extracted.deductibility as any) || null,
        method: 'AI' as any,
        aiConfidence: confidence,
        aiSuggestion: extracted.category_suggestion || null,
        notes: notesLines.length > 0 ? notesLines.join('\n') : null,
      },
    })

    const receipt = await prisma.receipt.create({
      data: {
        transactionId: transaction.id,
        filename: file.name,
        data: base64Data,
        mimeType: rawMime,
      },
    })

    await logAudit({ userId, businessId, action: 'SCAN_RECEIPT', entity: 'Transaction', entityId: transaction.id, metadata: { merchant: extracted.merchant, amount, confidence, file: file.name } })
    return NextResponse.json({
      receiptId: receipt.id,
      transactionId: transaction.id,
      status: txStatus,
      extracted,
      mimeType: rawMime,
    })
  } catch (e: any) {
    console.error('Receipt scan error:', e)
    return NextResponse.json({ error: e.message || 'Scan failed' }, { status: 500 })
  }
}
