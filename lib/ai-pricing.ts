// Pure pricing math shared between server code (lib/ai-budget.ts) and client
// components (the admin businesses page, to preview a budget as a transaction
// count live as the admin types it). No server-only imports here on purpose.

// Claude Haiku 4.5 pricing: $1.00 / 1M input tokens, $5.00 / 1M output tokens
const INPUT_CENTS_PER_MTOK = 100
const OUTPUT_CENTS_PER_MTOK = 500

// Rough average cost per classified transaction (~75 input + ~55 output tokens),
// used only to translate a $ budget into a transaction count so business users
// see a usage bar without ever seeing dollar figures, and so admins can see
// what a budget they're typing actually buys.
const AVG_COST_CENTS_PER_TRANSACTION = (75 * INPUT_CENTS_PER_MTOK + 55 * OUTPUT_CENTS_PER_MTOK) / 1_000_000

export function tokensToCents(inputTokens: number, outputTokens: number): number {
  return Math.round(
    (inputTokens * INPUT_CENTS_PER_MTOK + outputTokens * OUTPUT_CENTS_PER_MTOK) / 1_000_000
  )
}

export function estimateTransactionLimit(budgetCents: number | null | undefined): number | null {
  if (!budgetCents) return null
  return Math.floor(budgetCents / AVG_COST_CENTS_PER_TRANSACTION)
}
