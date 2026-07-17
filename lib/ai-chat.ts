import { prisma } from './prisma'

// Shared between the chat endpoint (tool definition Claude sees) and the
// executor below (what actually runs against the DB). Keeping both in one
// file makes it obvious the executor must only accept fields the schema
// declares here — Claude never supplies businessId, that always comes from
// the authenticated request path.
export const QUERY_TRANSACTIONS_TOOL = {
  name: 'query_transactions',
  description:
    "Query this business's transactions. Use this for any question about the business's transactions, spending, categories, totals, or counts — never guess or answer from memory. Choose mode 'count' for \"how many\", 'sum' for total amounts, or 'list' to show individual transactions.",
  input_schema: {
    type: 'object' as const,
    properties: {
      mode: {
        type: 'string',
        enum: ['count', 'sum', 'list', 'breakdown'],
        description: "'count' = number of matching transactions, 'sum' = total amount of matching transactions, 'list' = the transactions themselves, 'breakdown' = totals grouped by category (use this for \"spending by category\" questions instead of calling 'sum' once per category)",
      },
      categoryName: { type: 'string', description: 'Filter by category name (partial match, case-insensitive), e.g. "Office Expenses"' },
      status: { type: 'string', enum: ['PENDING', 'CLASSIFIED', 'NEEDS_REVIEW'], description: 'Filter by classification status' },
      type: { type: 'string', enum: ['DEBIT', 'CREDIT'], description: 'Filter by transaction type' },
      deductibility: { type: 'string', enum: ['YES', 'NO', 'FIFTY'], description: 'Filter by tax deductibility' },
      method: { type: 'string', enum: ['MANUAL', 'AI', 'RULE'], description: 'Filter by how the transaction was classified' },
      search: { type: 'string', description: 'Free-text search within the transaction description' },
      dateFrom: { type: 'string', description: 'Start date, inclusive, format YYYY-MM-DD' },
      dateTo: { type: 'string', description: 'End date, inclusive, format YYYY-MM-DD' },
      limit: { type: 'integer', description: 'Max rows to return when mode is "list" (default 20, max 50)' },
    },
    required: ['mode'],
    additionalProperties: false,
  },
}

const STATUS_VALUES = new Set(['PENDING', 'CLASSIFIED', 'NEEDS_REVIEW'])
const TYPE_VALUES = new Set(['DEBIT', 'CREDIT'])
const DEDUCTIBILITY_VALUES = new Set(['YES', 'NO', 'FIFTY'])
const METHOD_VALUES = new Set(['MANUAL', 'AI', 'RULE'])

export interface QueryTransactionsInput {
  mode?: string
  categoryName?: string
  status?: string
  type?: string
  deductibility?: string
  method?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}

// businessId always comes from the authenticated request path, never from
// the model's tool call input — this is the scoping boundary that keeps the
// chat from ever reading another business's data.
export async function runQueryTransactions(businessId: string, input: QueryTransactionsInput): Promise<unknown> {
  const where: any = { businessId }

  if (input.categoryName) where.category = { name: { contains: String(input.categoryName), mode: 'insensitive' } }
  if (input.status && STATUS_VALUES.has(input.status)) where.status = input.status
  if (input.type && TYPE_VALUES.has(input.type)) where.type = input.type
  if (input.deductibility && DEDUCTIBILITY_VALUES.has(input.deductibility)) where.deductibility = input.deductibility
  if (input.method && METHOD_VALUES.has(input.method)) where.method = input.method
  if (input.search) where.description = { contains: String(input.search), mode: 'insensitive' }

  if (input.dateFrom || input.dateTo) {
    where.date = {}
    if (input.dateFrom) {
      const d = new Date(`${input.dateFrom}T00:00:00`)
      if (!isNaN(d.getTime())) where.date.gte = d
    }
    if (input.dateTo) {
      const d = new Date(`${input.dateTo}T23:59:59`)
      if (!isNaN(d.getTime())) where.date.lte = d
    }
    if (Object.keys(where.date).length === 0) delete where.date
  }

  if (input.mode === 'count') {
    const count = await prisma.transaction.count({ where })
    return { count }
  }

  if (input.mode === 'sum') {
    const agg = await prisma.transaction.aggregate({ where, _sum: { amount: true }, _count: true })
    return { count: agg._count, totalAmount: agg._sum.amount ?? 0 }
  }

  if (input.mode === 'breakdown') {
    const rows = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: true,
    })
    const categoryIds = rows.map(r => r.categoryId).filter((id): id is string => !!id)
    const categories = categoryIds.length
      ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : []
    const nameById = new Map(categories.map(c => [c.id, c.name]))
    const breakdown = rows
      .map(r => ({
        category: r.categoryId ? (nameById.get(r.categoryId) ?? 'Unknown category') : 'Uncategorized',
        count: r._count,
        totalAmount: r._sum.amount ?? 0,
      }))
      .sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount))
    return { breakdown }
  }

  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50)
  const rows = await prisma.transaction.findMany({
    where,
    take: limit,
    orderBy: { date: 'desc' },
    select: {
      date: true,
      description: true,
      amount: true,
      type: true,
      status: true,
      deductibility: true,
      category: { select: { name: true } },
    },
  })
  return {
    count: rows.length,
    truncated: rows.length === limit,
    transactions: rows.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      description: r.description,
      amount: r.amount,
      type: r.type,
      status: r.status,
      deductibility: r.deductibility,
      category: r.category?.name ?? null,
    })),
  }
}
