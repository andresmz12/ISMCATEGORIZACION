# Database Schema Documentation

## Overview

Multi-tenant architecture supporting:
- Multiple accounting firms (Accountants)
- Multiple clients per firm (Businesses)
- Multiple users per firm with role-based access
- Transaction imports, categorization, and approval workflows

---

## Entity Relationship Diagram (Text)

```
┌─────────────────┐
│  Accountant     │ (Firm/Tenant)
├─────────────────┤
│ id              │
│ name            │
│ email           │ unique
│ createdAt       │
│ updatedAt       │
└────────┬────────┘
         │
         │ 1:N
         ├─────────────────────┬─────────────────────┬──────────────────┐
         │                     │                     │                  │
    ┌────▼──────────┐  ┌───────▼────────┐  ┌────────▼────────┐  ┌──────▼──────────┐
    │   Business    │  │     User       │  │   Plan          │  │  AuditLog       │
    ├───────────────┤  ├────────────────┤  ├─────────────────┤  ├─────────────────┤
    │ id            │  │ id             │  │ id              │  │ id              │
    │ name          │  │ email (unique) │  │ type (enum)     │  │ action (enum)   │
    │ industry      │  │ passwordHash   │  │ maxBusinesses   │  │ entityType      │
    │ entityType    │  │ isActive       │  │ maxUsers        │  │ createdAt       │
    │ taxYear       │  │ createdAt      │  │ includeAI       │  └─────────────────┘
    └────┬──────────┘  └────┬───────────┘  └─────────────────┘
         │                  │
         │ 1:N         N:M (via UserBusiness)
         │                  │
         │           ┌──────▼──────────┐
         │           │ UserBusiness    │
         │           ├─────────────────┤
         │           │ userId          │
         │           │ businessId      │
         │           │ role (enum)     │
         │           └─────────────────┘
         │                  ▲
         │                  │
         │ 1:N          N:M relation
         ├────────────────┤
         │                │
    ┌────▼──────────────┐ │
    │ BankImport        │◄┘
    ├───────────────────┤
    │ id                │
    │ businessId        │
    │ filename          │
    │ fileType          │
    │ bankName          │
    │ transactionCount  │
    │ mappingUsed (JSON)│
    │ importedDate      │
    └────┬──────────────┘
         │
         │ 1:N
         └──────────────────┬──────────────────────┐
                            │                      │
                       ┌────▼──────────┐      ┌────▼──────────────┐
                       │ Transaction   │      │ Category          │
                       ├───────────────┤      ├───────────────────┤
                       │ id            │      │ id                │
                       │ businessId    │      │ businessId        │
                       │ date          │      │ code              │
                       │ description   │      │ name              │
                       │ amount        │      │ irsLine           │
                       │ type          │      │ deductibility     │
                       │ categoryId ───┼──────►│ description       │
                       │ status        │      │ isActive          │
                       │ method        │      └───────────────────┘
                       │ confidence    │
                       │ deductibility │
                       └───────────────┘
                              ▲
                              │ N:1
                              │
                       ┌──────┴──────────────┐
                       │ClassificationRule  │
                       ├────────────────────┤
                       │ id                 │
                       │ businessId         │
                       │ categoryId         │
                       │ keyword            │
                       │ priority           │
                       │ isActive           │
                       └────────────────────┘
```

---

## Table Details

### `accountants`

**Purpose**: Top-level tenant. One per accounting firm/business.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `name` | String | Required | Firm name |
| `email` | String | Unique, Required | Primary contact |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**: 
- `email` (UNIQUE)

---

### `businesses`

**Purpose**: Clients/entities under an accountant. Each business has its own transactions, categories, and rules.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `accountantId` | String | FK, Required | Parent accountant |
| `name` | String | Required | Business name |
| `industry` | String | Default: "Other" | Tax industry code |
| `entityType` | String | Default: "Sole Proprietor (Schedule C)" | Legal structure |
| `taxYear` | Int | Default: 2025 | Tax year for reporting |
| `planId` | String | FK, Optional | Linked subscription plan |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**:
- `accountantId` (FK)
- UNIQUE(`accountantId`, `name`)

**Constraints**:
- ON DELETE CASCADE: If accountant is deleted, all businesses deleted
- ON DELETE SET NULL: If plan is deleted, business keeps data but loses plan reference

---

### `users`

**Purpose**: Team members. Can have access to multiple businesses with different roles.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `accountantId` | String | FK, Required | Parent accountant |
| `email` | String | Required | User email |
| `name` | String | Optional | Display name |
| `passwordHash` | String | Required | bcrypt hash (not SHA-256) |
| `isActive` | Boolean | Default: true | Soft delete |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**:
- `accountantId` (FK)
- UNIQUE(`accountantId`, `email`)

**Constraints**:
- ON DELETE CASCADE: If accountant deleted, all users deleted

---

### `users_businesses`

**Purpose**: Many-to-many junction table. Links users to businesses with role-based permissions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `userId` | String | FK, Required | User reference |
| `businessId` | String | FK, Required | Business reference |
| `role` | Enum | Default: VIEWER | OWNER, MANAGER, or VIEWER |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**:
- `userId` (FK)
- `businessId` (FK)
- UNIQUE(`userId`, `businessId`)

**Constraints**:
- ON DELETE CASCADE: If user/business deleted, join record deleted

**Roles**:
- `OWNER`: Full access to business (manage users, categories, rules, approve transactions)
- `MANAGER`: Can manage transactions and rules, view all data
- `VIEWER`: Read-only access to transactions and reports

---

### `bank_imports`

**Purpose**: Audit trail for file uploads. Tracks which file was imported when and how many transactions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `businessId` | String | FK, Required | Parent business |
| `filename` | String | Required | Original filename |
| `fileType` | String | Required | "csv", "xlsx", "pdf" |
| `bankName` | String | Optional | "Chase", "BofA", etc. |
| `transactionCount` | Int | Required | Number of transactions in file |
| `mappingUsed` | String | Required | JSON serialized column mapping |
| `notes` | String | Optional | Admin notes |
| `importedDate` | DateTime | Default: now() | When file was uploaded |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**:
- `businessId` (FK)
- `importedDate` (for timeline queries)

**Constraints**:
- ON DELETE CASCADE: If business deleted, all imports deleted

---

### `transactions`

**Purpose**: Individual expense transactions. Core table for the classification workflow.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `businessId` | String | FK, Required | Parent business |
| `bankImportId` | String | FK, Required | Source file |
| `date` | DateTime | Required | Transaction date |
| `description` | String | Required | Merchant/payee name |
| `amount` | Decimal(12,2) | Required | Absolute value in USD |
| `type` | String | Default: "DEBIT" | "DEBIT" or "CREDIT" |
| `categoryId` | String | FK, Optional | Assigned category |
| `status` | Enum | Default: PENDING | Workflow status |
| `method` | Enum | Optional | How it was classified |
| `deductibility` | Enum | Default: NO | YES, NO, or FIFTY (50%) |
| `confidence` | String | Optional | "HIGH", "MEDIUM", "LOW" |
| `irsLine` | String | Optional | "Schedule C - Line 24a", etc. |
| `classifiedAt` | DateTime | Optional | When classified |
| `classifiedBy` | String | Optional | User ID who classified |
| `approvedAt` | DateTime | Optional | When approved |
| `approvedBy` | String | Optional | User ID who approved |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**:
- `businessId` (FK)
- `bankImportId` (FK)
- `categoryId` (FK)
- `status` (for filtering)
- `date` (for range queries)

**Constraints**:
- ON DELETE CASCADE: If business/import deleted, transactions deleted
- ON DELETE SET NULL: If category deleted, transaction loses category

**Enums**:
- `status`: PENDING → CLASSIFIED → APPROVED (or REJECTED)
- `method`: MANUAL (user picked), RULE (automatic rule), AI (Claude classified)
- `deductibility`: YES (100%), NO (0%), FIFTY (50%)

---

### `categories`

**Purpose**: Chart of accounts per business. Each business defines its own categories with IRS mappings.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `businessId` | String | FK, Required | Parent business |
| `code` | String | Required | COA code (e.g., "4100") |
| `name` | String | Required | Category display name |
| `irsLine` | String | Optional | IRS Schedule C reference |
| `deductibility` | Enum | Default: NO | YES, NO, or FIFTY |
| `description` | String | Optional | Notes |
| `isActive` | Boolean | Default: true | Soft delete |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**:
- `businessId` (FK)
- UNIQUE(`businessId`, `code`)

**Constraints**:
- ON DELETE CASCADE: If business deleted, all categories deleted

**Example Categories**:
- "Travel" → "Schedule C - Line 24a" → YES
- "Meals (50% Deductible)" → "Schedule C - Line 24b" → FIFTY
- "Personal (Non-Deductible)" → "N/A" → NO

---

### `classification_rules`

**Purpose**: Keyword-based rules for automatic categorization. If transaction description contains keyword, assign to category.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `businessId` | String | FK, Required | Parent business |
| `categoryId` | String | FK, Required | Target category |
| `keyword` | String | Required | Substring to match (case-insensitive) |
| `priority` | Int | Default: 0 | Higher = applies first |
| `isActive` | Boolean | Default: true | Can disable rule |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**:
- `businessId` (FK)
- `categoryId` (FK)

**Constraints**:
- ON DELETE CASCADE: If business/category deleted, rules deleted

**Example Rules**:
- keyword: "Starbucks" → category: "Meals (50% Deductible)"
- keyword: "Shell" → category: "Fuel"
- keyword: "Airbnb" → category: "Travel"

---

### `plans`

**Purpose**: Subscription tiers controlling features and limits.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `accountantId` | String | FK, Required | Tenant |
| `type` | Enum | Required | BASIC, PLUS, ENTERPRISE |
| `maxBusinesses` | Int | Default: 1 | Max clients allowed |
| `maxTransactions` | Int | Default: 10000 | Transactions per year |
| `maxUsers` | Int | Default: 3 | Team members |
| `maxFileSize` | Int | Default: 10 | File upload size in MB |
| `includeAI` | Boolean | Default: false | Access to Claude API |
| `createdAt` | DateTime | Default: now() | Timestamp |
| `updatedAt` | DateTime | Auto-update | Timestamp |

**Indexes**:
- `accountantId` (FK)

**Constraints**:
- ON DELETE CASCADE: If accountant deleted, plan deleted

**Plans**:
- BASIC: 1 business, 10K transactions, 3 users, no AI, $29/mo
- PLUS: 5 businesses, 50K transactions, 10 users, with AI, $99/mo
- ENTERPRISE: Unlimited, custom support, $999/mo

---

### `audit_logs`

**Purpose**: Compliance and debugging. Tracks who did what when.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String (CUID) | PK | Unique identifier |
| `businessId` | String | Required | Scoped to business |
| `action` | Enum | Required | TRANSACTION_CLASSIFIED, etc. |
| `entityType` | String | Required | "Transaction", "ClassificationRule" |
| `entityId` | String | Required | ID of affected entity |
| `userId` | String | Optional | User who performed action |
| `details` | String | Optional | JSON serialized details |
| `createdAt` | DateTime | Default: now() | Timestamp |

**Indexes**:
- `businessId`
- `createdAt`

**Actions**:
- TRANSACTION_CLASSIFIED
- TRANSACTION_APPROVED
- RULE_CREATED
- RULE_UPDATED
- USER_ADDED
- USER_REMOVED

---

## Design Principles

### 1. Multi-Tenancy

Every table that has customer data is scoped by:
- Level 1: `accountantId` (firm)
- Level 2: `businessId` (client within firm)

This ensures data isolation and enables row-level security policies.

### 2. Soft Deletes

`isActive` boolean used instead of hard deletes for:
- `users`
- `categories`
- `classification_rules`

Preserves historical data and allows "undelete" if needed.

### 3. Audit Trail

`createdAt`, `updatedAt`, and `classifiedAt`/`classifiedBy` fields track:
- When transaction was created (import date)
- When it was classified (AI, rule, or manual)
- Who approved it

Separate `audit_logs` table for compliance.

### 4. Workflow Status

Transactions follow a clear workflow:

```
PENDING → CLASSIFIED → APPROVED
           ↓
         REJECTED
```

- PENDING: Not yet processed
- CLASSIFIED: AI or rule assigned category
- APPROVED: User reviewed and accepted
- REJECTED: Flagged for manual review

### 5. Flexibility

- `industry` and `entityType` are strings (not enums) to support custom values
- `description` on categories for business-specific notes
- `mappingUsed` JSON in BankImport to remember column mappings per file
- `details` JSON in AuditLog for flexible logging

---

## Query Examples

### Get all transactions for a business

```sql
SELECT * FROM transactions 
WHERE businessId = $1 
ORDER BY date DESC
```

### Get classification summary by category

```sql
SELECT 
  c.name,
  c.irsLine,
  COUNT(*) as count,
  SUM(t.amount) as total
FROM transactions t
JOIN categories c ON t.categoryId = c.id
WHERE t.businessId = $1
  AND t.status = 'APPROVED'
GROUP BY c.id
ORDER BY total DESC
```

### Find pending transactions

```sql
SELECT * FROM transactions 
WHERE businessId = $1 
  AND status = 'PENDING'
ORDER BY date DESC
```

### Get user's businesses with roles

```sql
SELECT b.*, ub.role
FROM businesses b
JOIN users_businesses ub ON b.id = ub.businessId
WHERE ub.userId = $1
```

### Count transactions by method and confidence

```sql
SELECT 
  method,
  confidence,
  COUNT(*) as count
FROM transactions
WHERE businessId = $1
GROUP BY method, confidence
```

---

## Migration Notes

### From FastAPI/SQLite

Old schema only had `users` table. New schema adds:
- Accountant (firm/tenant)
- Business (client)
- UserBusiness (role-based access)
- All other tables for transaction management

Migration strategy:
1. Create 1 Accountant per old SQLite DB
2. Create 1 Business per Accountant
3. Migrate Users to new User table
4. Set all users as OWNER role initially
5. Create default Categories and ClassificationRules

---

## Performance Considerations

### Indexes

All foreign keys and frequently filtered fields are indexed:
- `accountantId`, `businessId`, `userId`
- `status`, `date`, `categoryId`
- Composite unique constraints on multi-tenant queries

### Query Optimization

For large transaction lists:
- Use pagination (limit 100 per page)
- Batch AI classifications (50 at a time)
- Cache category lookups
- Pre-compute summaries (denormalization if needed)

### Scalability

As data grows:
- Consider table partitioning by `businessId`
- Archive old transactions to separate table
- Use materialized views for complex reports
- Implement caching layer (Redis) for hot data

---

## Next Steps

1. **Review this schema** - Confirm entities and relationships align with requirements
2. **Create migrations** - Run `npx prisma migrate dev --name init`
3. **Seed data** - Run `npm run db:seed` with sample accountants, businesses, users
4. **Implement API routes** - Build REST/GraphQL endpoints for each entity
5. **Implement auth** - NextAuth.js with role-based authorization
6. **Implement classification** - Connect Claude API for transaction classification
7. **Build UI** - Dashboard, import, classification, reporting views
