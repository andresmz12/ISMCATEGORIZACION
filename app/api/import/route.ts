import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { logAudit } from '@/lib/audit'
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

    if (!await checkBusinessAccess(userId, businessId, accountType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const mapping = JSON.parse(mappingJson)
    const ext = file.name.split('.').pop()?.toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB allowed.' }, { status: 400 })
    }

    let rows: Record<string, unknown>[] = []

    if (ext === 'csv') {
      const { parse } = await import('csv-parse/sync')
      const parsed = parse(buffer.toString(), { columns: true, skip_empty_lines: true, trim: true })
      rows = parsed
    } else if (ext === 'xlsx' || ext === 'xls') {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer as any)
      const ws = wb.worksheets[0]
      const headers: string[] = []
      ws.getRow(headerRow).eachCell((cell) => headers.push(String(cell.value ?? '')))
      ws.eachRow((row, rowNum) => {
        if (rowNum <= headerRow) return
        const rowObj: Record<string, unknown> = {}
        row.eachCell((cell, colNum) => {
          // Preserve Date objects so parseDate can use them directly
          rowObj[headers[colNum - 1]] = cell.value instanceof Date ? cell.value : String(cell.value ?? '')
        })
        rows.push(rowObj)
      })
    } else {
      return NextResponse.json({ error: 'Only CSV and XLSX supported for import' }, { status: 400 })
    }

    // Save bank mapping for reuse
    if (bankName) {
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
            data: { businessId, date, description: descVal, amount, type, status: 'PENDING', checksum, sourceFile: file.name },
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
        errors.push(`Row ${i + 2}: ${e.message}`)
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
