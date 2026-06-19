# ISM Categorización - Next.js 14 + Prisma + PostgreSQL

Enterprise-grade expense categorization and IRS compliance platform with multi-tenant architecture.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth**: NextAuth.js v4
- **AI**: Anthropic Claude API
- **File Handling**: XLSX, CSV, PDF parsing
- **State**: Zustand (client-side)
- **Forms**: React Hook Form + Zod validation

## Project Structure

```
ISMCATEGORIZACION_NextJS/
├── app/                    # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Protected dashboard routes
│   └── api/               # API routes
│       ├── auth/
│       ├── businesses/
│       ├── transactions/
│       ├── classifications/
│       └── imports/
├── lib/                    # Shared utilities
│   ├── db.ts             # Prisma client
│   ├── auth.ts           # Auth utilities
│   └── types/            # TypeScript types
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seeding
├── public/               # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Multi-Tenant Architecture

### Tenant Hierarchy

```
Accountant (Firm/Tenant)
├── Users (multiple, with roles)
│   ├── OWNER: Full access to all businesses
│   ├── MANAGER: Manage specific businesses
│   └── VIEWER: Read-only access
├── Businesses (multiple clients)
│   ├── Categories (Chart of Accounts)
│   ├── Classification Rules
│   ├── Bank Imports
│   └── Transactions
└── Plan/Subscription (1 per accountant)
```

### Key Relationships

- **Accountant → Business**: 1 Accountant can have many Businesses
- **Accountant → User**: 1 Accountant can have many Users
- **User ↔ Business**: Many-to-many via `UserBusiness` (with role)
- **Business → Transactions**: 1 Business can have many Transactions
- **Business → Categories**: Chart of Accounts per Business
- **Business → ClassificationRules**: Custom rules per Business

## Database Schema

### Core Tables

#### `accountants`
Top-level tenant. Represents a single accounting firm or business.

#### `businesses`
Clients/entities under an accountant. Each has its own chart of accounts, transactions, and rules.

#### `users`
Team members. Can have access to multiple businesses with different roles.

#### `users_businesses`
Junction table defining role-based access (OWNER, MANAGER, VIEWER).

#### `transactions`
Individual expense transactions. Linked to business, bank import, and category.

**Fields**:
- `status`: PENDING, CLASSIFIED, APPROVED, REJECTED
- `method`: MANUAL, RULE, AI
- `deductibility`: YES, NO, 50%
- `confidence`: HIGH, MEDIUM, LOW (from AI)

#### `categories`
Chart of accounts per business. Contains IRS Schedule C line mappings.

#### `classification_rules`
Keyword-based rules for automatic categorization (e.g., if description contains "Starbucks", assign to "Meals").

#### `bank_imports`
Record of each file upload. Tracks filename, type, bank, and transaction count.

#### `plans`
Subscription tiers (BASIC, PLUS, ENTERPRISE) controlling features and limits.

#### `audit_logs`
Activity trail for compliance and debugging.

## Prisma Enums

```typescript
enum UserRole { OWNER, MANAGER, VIEWER }
enum TransactionStatus { PENDING, CLASSIFIED, APPROVED, REJECTED }
enum ClassificationMethod { MANUAL, RULE, AI }
enum DeductibilityType { YES, NO, FIFTY }
enum PlanType { BASIC, PLUS, ENTERPRISE }
enum AuditAction { ... }
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Environment variables (see `.env.example`)

### Installation

```bash
npm install
```

### Setup Database

```bash
# Create migrations
npx prisma migrate dev --name init

# View database in GUI
npx prisma studio

# Seed with sample data
npm run db:seed
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Routes (To Be Implemented)

### Authentication
- `POST /api/auth/register` - Register accountant
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout

### Businesses
- `GET /api/businesses` - List user's businesses
- `POST /api/businesses` - Create business
- `GET /api/businesses/[id]` - Get business details
- `PUT /api/businesses/[id]` - Update business

### Transactions
- `GET /api/businesses/[id]/transactions` - List transactions
- `POST /api/businesses/[id]/transactions/import` - Upload file
- `PUT /api/transactions/[id]` - Update classification
- `POST /api/transactions/[id]/approve` - Approve transaction

### Classifications
- `POST /api/classifications/batch` - Classify multiple transactions via AI
- `GET /api/classifications/summary` - Get summary by category

### Rules
- `GET /api/businesses/[id]/rules` - List classification rules
- `POST /api/businesses/[id]/rules` - Create rule
- `DELETE /api/businesses/[id]/rules/[id]` - Delete rule

## AI Classification Flow

1. User uploads file (CSV, XLSX, PDF)
2. File is parsed and normalized to transaction list
3. Transactions are filtered (remove deposits, payments, etc.)
4. Batch call to Claude API for classification
5. Results stored in database with confidence levels
6. User reviews and approves classifications
7. Final report generated with IRS mappings

See `ai-classification-reference.md` for detailed prompt and logic.

## Security Considerations

- Row-level security via tenant isolation (accountantId)
- Role-based access control (OWNER, MANAGER, VIEWER)
- Password hashing with bcrypt (not SHA-256)
- JWT tokens with expiration
- CORS configured for frontend origin
- File upload validation (size, type, virus scan)
- SQL injection prevention via Prisma ORM

## Performance Optimizations

- Indexed fields: `accountantId`, `businessId`, `userId`, `status`, `date`
- Pagination for large transaction lists
- Batched AI classifications (50 transactions per call)
- Caching layer (Redis) for category lookups
- Database connection pooling

## Deployment

### Railway (Production)

Create two services:
1. **Database**: PostgreSQL 14+
2. **App**: Next.js with environment variables linked to database

### Environment Variables

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
ANTHROPIC_API_KEY="..."
NEXT_PUBLIC_API_URL="https://..."
```

## Migration from FastAPI

### What Changes

- Python + FastAPI → Next.js API routes
- SQLite → PostgreSQL
- Direct SQL → Prisma ORM
- React SPA → Next.js App Router with server components
- Token management → NextAuth.js

### What Stays the Same

- AI classification logic (Claude prompt remains identical)
- Fallback keyword matching rules
- Excel report generation (repurpose with server-side PDF generation)
- File parsing logic (adapt to Node.js libraries)

### Data Migration Plan

1. Export transactions from old SQLite
2. Transform to new schema format
3. Bulk insert into PostgreSQL
4. Validate counts and mappings

## Contributing

See CONTRIBUTING.md for guidelines.

## License

Proprietary - ISM Consulting Services
