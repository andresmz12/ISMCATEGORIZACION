// Pure pricing math shared between server code (lib/ai-budget.ts) and client
// components (the admin businesses page, to preview a budget as a transaction
// count live as the admin types it). No server-only imports here on purpose.

// Claude Haiku 4.5 pricing: $1.00 / 1M input tokens, $5.00 / 1M output tokens
const INPUT_CENTS_PER_MTOK = 100
const OUTPUT_CENTS_PER_MTOK = 500

// Average cost per classified transaction, used only to translate a $ budget
// into a transaction count for display (the business-user usage bar, and the
// live estimate on the admin businesses page) — the actual $ enforcement in
// checkAiBudget/recordAiUsage always uses the real token counts the Anthropic
// API returns per call, never this estimate.
//
// Derived by reconstructing the exact prompt shape from classify-ai/route.ts
// (an 18-category system prompt + a 20-transaction batch with realistic bank
// descriptions) and measuring it at ~4 chars/token: ~48 input + ~50 output
// tokens/transaction. Rounded up slightly (60/60) as a safety margin, since
// JSON punctuation tends to tokenize less efficiently than plain prose and
// real transaction descriptions can run longer than the sample — better to
// under-promise the transaction count than to over-promise it.
const AVG_COST_CENTS_PER_TRANSACTION = (60 * INPUT_CENTS_PER_MTOK + 60 * OUTPUT_CENTS_PER_MTOK) / 1_000_000

export function tokensToCents(inputTokens: number, outputTokens: number): number {
  return Math.round(
    (inputTokens * INPUT_CENTS_PER_MTOK + outputTokens * OUTPUT_CENTS_PER_MTOK) / 1_000_000
  )
}

export function estimateTransactionLimit(budgetCents: number | null | undefined): number | null {
  if (!budgetCents) return null
  return Math.floor(budgetCents / AVG_COST_CENTS_PER_TRANSACTION)
}
