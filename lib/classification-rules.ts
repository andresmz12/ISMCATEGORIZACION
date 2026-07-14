import { prisma } from './prisma'

export interface ClassificationRuleRecord {
  id: string
  pattern: string
  field: string
  categoryId: string
  deductibility: string | null
}

export interface RuleMatch {
  categoryId: string
  deductibility: string | null
  ruleId: string
}

// Rules are matched highest-priority first, same ordering as the /rules UI.
export async function getActiveRules(businessId: string): Promise<ClassificationRuleRecord[]> {
  return prisma.classificationRule.findMany({
    where: { businessId },
    orderBy: { priority: 'desc' },
    select: { id: true, pattern: true, field: true, categoryId: true, deductibility: true },
  })
}

export function matchRule(
  rules: ClassificationRuleRecord[],
  tx: { description: string; amount: number }
): RuleMatch | null {
  for (const rule of rules) {
    const value = rule.field === 'amount' ? String(tx.amount) : tx.description
    try {
      if (new RegExp(rule.pattern, 'i').test(value)) {
        return { categoryId: rule.categoryId, deductibility: rule.deductibility, ruleId: rule.id }
      }
    } catch {
      continue // corrupt/legacy pattern — skip rather than fail the whole batch
    }
  }
  return null
}
