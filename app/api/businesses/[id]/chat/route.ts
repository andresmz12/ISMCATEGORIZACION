import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkBusinessAccess } from '@/lib/check-business-access'
import { checkAiBudget, recordAiUsage } from '@/lib/ai-budget'
import { QUERY_TRANSACTIONS_TOOL, runQueryTransactions } from '@/lib/ai-chat'

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `You are a data assistant embedded in an accounting app. You answer questions about ONE business's transactions using the query_transactions tool — never guess numbers or answer from memory. Always call the tool before stating any count, sum, list, or breakdown of transactions. Today's date is ${today} — use it to resolve relative date ranges like "this month", "last 30 days", "this year", or "last quarter" into concrete dateFrom/dateTo values for the tool; never guess a date range without deriving it from today. Detect the language of the user's LATEST message (Spanish or English) and reply in that language, even if earlier messages in the conversation were in the other language — the user may switch languages mid-conversation and each reply should match the message it's answering. Keep answers short and direct: lead with the number, total, or breakdown, skip preamble. If a list result is truncated, mention the total count and summarize rather than listing every row. If the question is unrelated to this business's transactions, say briefly (in the same detected language) that you can only help with questions about their transactions.`
}

const MAX_TOOL_ITERATIONS = 4
const MAX_HISTORY_MESSAGES = 20
const MAX_MESSAGE_LENGTH = 2000

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const accountType = (session.user as any).accountType
  const businessId = params.id

  if (!await checkBusinessAccess(userId, businessId, accountType)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { chatbotEnabled: true },
  })
  if (!business?.chatbotEnabled) {
    return NextResponse.json({ error: 'El asistente de chat no está habilitado para este negocio' }, { status: 403 })
  }

  const budgetDenied = await checkAiBudget(businessId)
  if (budgetDenied) return budgetDenied

  // 60 chat messages per user per hour — generous since each turn is cheap,
  // but still bounded to prevent runaway usage against the AI API.
  const rl = rateLimit(`chat:${userId}`, 60, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const body = await req.json()
  const message: string = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })
  if (message.length > MAX_MESSAGE_LENGTH) return NextResponse.json({ error: 'message too long' }, { status: 400 })

  const incomingHistory: Anthropic.MessageParam[] = Array.isArray(body.history)
    ? body.history
        .filter((m: any) =>
          m && (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' && m.content.length <= MAX_MESSAGE_LENGTH
        )
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m: any) => ({ role: m.role, content: m.content }))
    : []

  const messages: Anthropic.MessageParam[] = [...incomingHistory, { role: 'user', content: message }]

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let finalText = ''
  let errorResponse: NextResponse | null = null

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      let response: Anthropic.Message
      try {
        response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1536,
          system: buildSystemPrompt(),
          tools: [QUERY_TRANSACTIONS_TOOL],
          messages,
        })
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) {
          errorResponse = NextResponse.json(
            { error: 'El asistente está saturado en este momento, intenta de nuevo en unos segundos' },
            { status: 503 }
          )
        } else {
          console.error('Chat AI error:', e)
          errorResponse = NextResponse.json({ error: 'El asistente no pudo responder, intenta de nuevo' }, { status: 502 })
        }
        break
      }

      totalInputTokens += response.usage.input_tokens
      totalOutputTokens += response.usage.output_tokens

      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      if (toolUseBlocks.length === 0) {
        finalText = response.content.filter(b => b.type === 'text').map((b: any) => b.text).join('\n').trim()
        break
      }

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const call of toolUseBlocks) {
        let result: unknown
        try {
          result = await runQueryTransactions(businessId, call.input as any)
        } catch (e: any) {
          result = { error: e.message || 'query failed' }
        }
        toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) })
      }
      messages.push({ role: 'user', content: toolResults })

      if (i === MAX_TOOL_ITERATIONS - 1) {
        finalText = 'No pude terminar de procesar esa pregunta, intenta reformularla de forma más específica.'
      }
    }
  } finally {
    // Record whatever tokens were actually spent even if a later iteration failed —
    // a partial multi-step exchange still cost real money.
    await recordAiUsage(businessId, totalInputTokens, totalOutputTokens, 0)
  }

  if (errorResponse) return errorResponse

  return NextResponse.json({
    reply: finalText,
    history: [...messages.filter(m => typeof m.content === 'string'), { role: 'assistant', content: finalText }].slice(-MAX_HISTORY_MESSAGES),
  })
}
