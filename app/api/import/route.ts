import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import Anthropic from '@anthropic-ai/sdk'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess, checkBusinessWriteAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { requirePlanFeature } from '@/lib/plan-limits'
import { checkAiBudget, withAiBudget } from '@/lib/ai-budget'
import crypto from 'crypto'

function makeChecksum(date: string, description: string, amount: number): string {
  return crypto.createHash('md5').update(`${date}|${description}|${amount}`).digest('hex')
}

function parseAmount(val: string): { amount: number; type: 'DEBIT' | 'CREDIT' } {
  const clean = String(val).replace(/[$,\s]/g, '')
  const num = parseFloat(clean)
  if (isNaN(num)) return { amount: 0, type: 'DEBIT' }
  return { amount: Math.abs(num), type: num < 0 ? 'DEBIT' : 'CREDIT' }
}

function parseDate(val: unknown): Date | null {
  // ExcelJS returns Date objects for date cells — use them directly
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val
  }

  const s = String(val).trim()
  if (!s) return null

  // YYYY-MM-DD  (parse as local noon to avoid UTC timezone shift)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)
    return isNaN(d.getTime()) ? null : d
  }

  // DD/MM/YYYY or MM/DD/YYYY  (slashes)
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, a, b, y] = slash.map(Number)
    // If first part > 12 it must be DD/MM; if second > 12 it must be MM/DD;
    // otherwise default to DD/MM (Latin American format)
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b]
    const d = new Date(y, month - 1, day, 12)
    return isNaN(d.getTime()) ? null : d
  }

  // DD-MM-YYYY or MM-DD-YYYY  (dashes, non-ISO)
  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dash) {
    const [, a, b, y] = dash.map(Number)
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b]
    const d = new Date(y, month - 1, day, 12)
    return isNaN(d.getTime()) ? null : d
  }

  // MM/DD/YY two-digit year
  const shortYear = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (shortYear) {
    const [, a, b, yy] = shortYear.map(Number)
    const y = yy < 50 ? 2000 + yy : 1900 + yy
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b]
    const d = new Date(y, month - 1, day, 12)
    return isNaN(d.getTime()) ? null : d
  }

  // Last resort: JS Date parsing (handles "Jun 15 2025" etc.)
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType

  const rl = rateLimit(`import:${userId}`, 30, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  try {
    const formData = await req.formData()
    const businessId = formData.get('businessId') as string
    const mappingJson = formData.get('mapping') as string
    const file = formData.get('file') as File
    const bankName = formData.get('bankName') as string | null
    const headerRow = Math.max(1, parseInt(formData.get('headerRow') as string || '1'))

    if (!businessId || !mappingJson || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!await checkBusinessWriteAccess(userId, businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const mapping = JSON.parse(mappingJson)

    // Dry run: only persist the bank format mapping for reuse, do NOT import
    // any transactions. Used by the "Clasificar con IA" preview-first flow,
    // where rows are saved later via /api/transactions/batch after user review.
    if ((formData.get('dryRun') as string) === 'true') {
      if (bankName) {
        await prisma.bankFormatMapping.upsert({
          where: { id: `${businessId}_${bankName.replace(/\s+/g, '_')}` },
          update: { mapping },
          create: { id: `${businessId}_${bankName.replace(/\s+/g, '_')}`, businessId, bankName, mapping },
        })
      }
      return NextResponse.json({ ok: true, dryRun: true, mappingSaved: !!bankName })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB allowed.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let rows: Record<string, unknown>[] = []

    if (ext === 'csv') {
      const { parse } = await import('csv-parse/sync')
      // Auto-detect delimiter: try comma first, fall back to semicolon
      const csvText = buffer.toString()
      const firstLine = csvText.split('\n')[0] || ''
      const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ','
      const parsed = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, delimiter, relax_quotes: true })
      rows = parsed
    } else if (ext === 'xlsx' || ext === 'xls') {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer as any)
      const ws = wb.worksheets[0]
      // Use includeEmpty so colNum indices stay aligned with header positions
      const headers: string[] = []
      ws.getRow(headerRow).eachCell({ includeEmpty: true }, (cell) => {
        headers.push(String(cell.value ?? '').trim())
      })
      ws.eachRow((row, rowNum) => {
        if (rowNum <= headerRow) return
        const rowObj: Record<string, unknown> = {}
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          const header = headers[colNum - 1]
          if (!header) return
          // Preserve Date objects so parseDate can use them directly
          rowObj[header] = cell.value instanceof Date ? cell.value : String(cell.value ?? '')
        })
        rows.push(rowObj)
      })
    } else if (ext === 'pdf') {
      // No columns to map in a PDF bank statement — an AI vision call reads
      // the document directly and returns transactions in the same shape
      // (date/description/amount) the CSV/XLSX branches produce, so the
      // dedup/create loop below runs unchanged regardless of source format.
      const denied = requirePlanFeature(session, 'receiptScan')
      if (denied) return denied
      const budgetDenied = await checkAiBudget(businessId)
      if (budgetDenied) return budgetDenied
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const base64Data = buffer.toString('base64')
      const documentContent: any = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }

      // Extraction only — matches CSV/XLSX import, which never classifies
      // either. Imported transactions always land as PENDING; classifying
      // them (by category, with AI or a rule) only ever happens through the
      // separate "Clasificar con IA" flow the user explicitly runs.
      const budgetResult = await withAiBudget(businessId, async () => {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8192,
          messages: [{
            role: 'user',
            content: [
              documentContent,
              {
                type: 'text',
                text: `Extract every transaction line from this bank statement (may span multiple pages). Return ONLY a JSON array (no markdown, no backticks, no explanation) of objects:
[{"date": "YYYY-MM-DD", "description": "merchant or memo text", "amount": 0.00, "type": "DEBIT" or "CREDIT"}]

Extraction rules:
- DEBIT = money leaving the account (withdrawals, purchases, fees, payments, transfers out — often shown with a "-" or "$-" sign). CREDIT = money entering it (deposits, refunds, transfers in, interest paid). "amount" is always positive; put the sign information only in "type".
- The statement may be in English or Spanish, and use US (MM/DD/YYYY) or Colombian/Latin American (DD/MM/YYYY) date order — infer which from the statement's own locale (Spanish column headers like "Fecha del movimiento", "Descripción", "Valor" indicate Colombian format) and always output "date" as YYYY-MM-DD.
- Many Colombian statements (Bancolombia, Nequi, Davivienda, etc.) show a transaction table with a "Valor" (or "Monto") column AND a separate running "Saldo" (balance) column — extract only "Valor" as the amount; never use "Saldo".
- Skip anything that isn't an individual transaction row: repeated table headers on each page, and any account summary block (e.g. "Resumen", "Saldo anterior", "Saldo actual", "Total abonos", "Total cargos", "Saldo promedio", "Cuentas por cobrar", "Retefuente" — these are period totals, not transactions).
- Merge a transaction whose description wraps across lines into a single entry.
- Return [] if no transactions are found.`,
              },
            ],
          }],
        })
        return { result: response, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, classifiedCount: 0 }
      })
      if (!budgetResult.ok) return budgetResult.response
      const response = budgetResult.result

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      let extracted: any[] = []
      try {
        const m = raw.match(/\[[\s\S]*\]/)
        if (m) extracted = JSON.parse(m[0])
      } catch {
        extracted = []
      }
      if (!Array.isArray(extracted) || extracted.length === 0) {
        return NextResponse.json({ error: 'No se pudieron extraer transacciones de este PDF. Verifica que sea un estado de cuenta bancario legible (no escaneado como imagen borrosa).' }, { status: 400 })
      }

      rows = extracted.map((tx: any) => ({
        date: tx.date,
        description: tx.description,
        amount: tx.type === 'DEBIT' ? `-${tx.amount}` : `${tx.amount}`,
      }))
      // No real column mapping exists for a PDF — the rows above always use
      // these fixed keys, so force the lookup below to match regardless of
      // whatever mapping (if any) the client sent.
      mapping.date = 'date'
      mapping.description = 'description'
      mapping.amount = 'amount'
      delete mapping.debit
      delete mapping.credit
    } else {
      return NextResponse.json({ error: 'Only CSV, XLSX and PDF supported for import' }, { status: 400 })
    }

    // Save bank mapping for reuse — not meaningful for a PDF (there's no
    // real column format to remember, just the fixed keys set above).
    if (bankName && ext !== 'pdf') {
      await prisma.bankFormatMapping.upsert({
        where: { id: `${businessId}_${bankName.replace(/\s+/g, '_')}` },
        update: { mapping },
        create: { id: `${businessId}_${bankName.replace(/\s+/g, '_')}`, businessId, bankName, mapping },
      })
    }

    const dateCol = mapping.date
    const descCol = mapping.description
    const amountCol = mapping.amount
    const debitCol = mapping.debit
    const creditCol = mapping.credit

    let imported = 0
    let duplicates = 0
    const errors: string[] = []
    const importedIds: string[] = []
    const duplicateRows: Array<{ row: number; date: string; description: string; amount: number; type: string; existingId: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const dateVal = row[dateCol]
        const descVal = String(row[descCol] ?? '')
        let amount: number
        let type: 'DEBIT' | 'CREDIT'

        if (amountCol && row[amountCol] !== undefined) {
          const p = parseAmount(String(row[amountCol] ?? ''))
          amount = p.amount
          type = p.type
        } else if (debitCol || creditCol) {
          const debit = debitCol ? parseFloat(String(row[debitCol] ?? '').replace(/[$,\s]/g, '')) : NaN
          const credit = creditCol ? parseFloat(String(row[creditCol] ?? '').replace(/[$,\s]/g, '')) : NaN
          const debitVal = isNaN(debit) ? 0 : Math.abs(debit)
          const creditVal = isNaN(credit) ? 0 : Math.abs(credit)
          if (debitVal > 0) { amount = debitVal; type = 'DEBIT' }
          else if (creditVal > 0) { amount = creditVal; type = 'CREDIT' }
          else { errors.push(`Row ${i + 2}: both debit and credit are zero or empty`); continue }
        } else {
          errors.push(`Row ${i + 2}: no amount column mapped`)
          continue
        }

        const date = parseDate(dateVal)
        if (!date) { errors.push(`Row ${i + 2}: invalid date "${dateVal}"`); continue }
        if (!descVal) { errors.push(`Row ${i + 2}: empty description`); continue }

        const checksum = makeChecksum(date.toISOString().split('T')[0], descVal, amount)

        // Use transaction to prevent race condition duplicates
        const result = await prisma.$transaction(async (tx: any) => {
          const existing = await tx.transaction.findFirst({ where: { businessId, checksum } })
          if (existing) {
            return { type: 'duplicate', id: existing.id }
          }
          const created = await tx.transaction.create({
            data: {
              businessId, date, description: descVal, amount, type, checksum, sourceFile: file.name,
              status: 'PENDING',
            },
          })
          return { type: 'created', id: created.id }
        })

        if (result.type === 'duplicate') {
          duplicates++
          duplicateRows.push({ row: i + 2, date: date.toISOString(), description: descVal, amount, type, existingId: result.id })
        } else {
          imported++
          importedIds.push(result.id)
        }
      } catch (e: any) {
        // P2002 = unique constraint violation on (businessId, checksum) — a
        // concurrent request beat this one to it; treat as a duplicate, not an error.
        if (e.code === 'P2002') {
          duplicates++
        } else {
          errors.push(`Row ${i + 2}: ${e.message}`)
        }
      }
    }

    await logAudit({ userId, businessId, action: 'IMPORT_TRANSACTIONS', metadata: { imported, duplicates, errors: errors.length, total: rows.length, file: file.name } })
    return NextResponse.json({ imported, duplicates, errors, total: rows.length, importedIds, duplicateRows })
  } catch (e: any) {
    console.error('import error:', e)
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const mappings = await prisma.bankFormatMapping.findMany({ where: { businessId } })
  return NextResponse.json(mappings)
}
