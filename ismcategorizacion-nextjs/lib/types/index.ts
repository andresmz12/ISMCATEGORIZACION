import { UserRole, TransactionStatus, ClassificationMethod, DeductibilityType, PlanType } from '@prisma/client'

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Authentication
export interface AuthSession {
  user: {
    id: string
    email: string
    name?: string
  }
  accountant: {
    id: string
    name: string
  }
}

// File upload
export interface FileUploadRequest {
  file: File
  businessId: string
  bankName?: string
}

export interface FileUploadResponse {
  bankImportId: string
  transactionCount: number
  preview: TransactionPreview[]
}

export interface TransactionPreview {
  date: string
  description: string
  amount: number
}

// Classification
export interface ClassificationRequest {
  transactions: RawTransaction[]
  industry: string
  businessId: string
}

export interface RawTransaction {
  date: string
  description: string
  amount: number
  type: 'DEBIT' | 'CREDIT'
}

export interface ClassificationResult {
  id: number
  category: string
  irs_line: string
  deductible: DeductibilityType
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ClassificationSummary {
  total_income: number
  total_expenses: number
  net: number
  categories: CategoryTotal[]
  transaction_count: number
}

export interface CategoryTotal {
  category: string
  total: number
}

// Business
export interface BusinessWithUsers {
  id: string
  name: string
  industry: string
  entityType: string
  taxYear: number
  users: {
    user: {
      id: string
      email: string
      name?: string
    }
    role: UserRole
  }[]
}

// Export types
export type { UserRole, TransactionStatus, ClassificationMethod, DeductibilityType, PlanType }
