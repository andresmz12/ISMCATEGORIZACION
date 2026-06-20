import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

function parseDate(val: string): Date | null {
  const s = String(val).trim()
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ]
  for (const f of formats) {
    const m = s.match(f)
    if (m) {
      const d = new Date(s)
      if (!isNaN(d.getTime())) return d
    }
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  try {
    const formData = await req.formData()
    const businessId = formData.get('businessId') as string
    const mappingJson = formData.get('mapping') as string
    const file = formData.get('file') as File
    const bankName = formData.get('bankName') as string | null

    if (!businessId || !mappingJson || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const bu = await prisma.businessUser.findUnique({ where: { userId_businessId: { userId, businessId } } })
    if (!bu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const mapping = JSON.parse(mappingJson)
    const ext = file.name.split('.').pop()?.toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())

    let rows: Record<string, string>[] = []

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
      ws.getRow(1).eachCell((cell) => headers.push(String(cell.value ?? '')))
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const rowObj: Record<string, string> = {}
        row.eachCell((cell, colNum) => {
          rowObj[headers[colNum - 1]] = String(cell.value ?? '')
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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const dateVal = row[dateCol]
        const descVal = row[descCol] || ''
        let amount: number
        let type: 'DEBIT' | 'CREDIT'

        if (amountCol && row[amountCol] !== undefined) {
          const p = parseAmount(row[amountCol])
          amount = p.amount
          type = p.type
        } else if (debitCol || creditCol) {
          const debit = parseFloat(String(row[debitCol] || '0').replace(/[$,]/g, '')) || 0
          const credit = parseFloat(String(row[creditCol] || '0').replace(/[$,]/g, '')) || 0
          if (debit > 0) { amount = debit; type = 'DEBIT' }
          else { amount = credit; type = 'CREDIT' }
        } else {
          errors.push(`Row ${i + 2}: no amount column mapped`)
          continue
        }

        const date = parseDate(dateVal)
        if (!date) { errors.push(`Row ${i + 2}: invalid date "${dateVal}"`); continue }
        if (!descVal) { errors.push(`Row ${i + 2}: empty description`); continue }

        const checksum = makeChecksum(date.toISOString().split('T')[0], descVal, amount)
        const existing = await prisma.transaction.findFirst({ where: { businessId, checksum } })
        if (existing) { duplicates++; continue }

        const tx = await prisma.transaction.create({
          data: { businessId, date, description: descVal, amount, type, status: 'PENDING', checksum, sourceFile: file.name },
        })
        imported++
        importedIds.push(tx.id)
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`)
      }
    }

    return NextResponse.json({ imported, duplicates, errors, total: rows.length, importedIds })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const mappings = await prisma.bankFormatMapping.findMany({ where: { businessId } })
  return NextResponse.json(mappings)
}
