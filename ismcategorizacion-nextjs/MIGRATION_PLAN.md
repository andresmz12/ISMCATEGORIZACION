# ISM Categorización - Migration Plan
## From Python/FastAPI + SQLite → Next.js 14 + Prisma + PostgreSQL

---

## Status: ✅ PHASE 1 & 2 COMPLETE - AWAITING REVIEW

This document outlines the migration strategy and current progress.

---

## What Has Been Created (Phase 1 & 2)

### Phase 1: AI Classification Reference ✅

**File**: `/home/user/ISMCATEGORIZACION/ai-classification-reference.md`

Extracted and documented:
- Claude model configuration (`claude-opus-4-6`, 8096 tokens)
- Complete prompt template (Spanish, 15+ category rules)
- Input/output format specifications
- Transaction filtering logic (removes deposits, payments)
- Fallback keyword matching system (15 categories)
- Error handling strategy
- Cost calculations (50 transactions per batch)

**Purpose**: Single source of truth for AI classification logic. Can be ported 1:1 to new Node.js stack.

---

### Phase 2: Next.js 14 + Prisma Project Structure ✅

**Location**: `/home/user/ISMCATEGORIZACION_NextJS/`

#### Created Files

**Configuration**:
- `package.json` - Dependencies (React 18, Next 14, Prisma, shadcn/ui, Anthropic SDK)
- `tsconfig.json` - TypeScript config with path aliases
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS theming
- `postcss.config.js` - PostCSS plugins
- `.env.example` - Environment variables template
- `.gitignore` - Git exclusions

**App Structure**:
- `app/layout.tsx` - Root layout with metadata
- `app/page.tsx` - Landing page placeholder
- `app/globals.css` - Global Tailwind styles

**Utilities**:
- `lib/db.ts` - Prisma client singleton
- `lib/types/index.ts` - TypeScript type definitions
- `prisma/schema.prisma` - **Full multi-tenant database schema**

**Documentation**:
- `README.md` - Project overview and setup instructions
- `SCHEMA.md` - **Detailed schema documentation with ERD, table definitions, and query examples**
- `MIGRATION_PLAN.md` - This file

---

## Phase 3: Database Schema ✅ REVIEW REQUIRED

**File**: `prisma/schema.prisma`

### Core Entities

```
Accountant (Firm/Tenant)
  ├── Users (with roles: OWNER, MANAGER, VIEWER)
  ├── Businesses (clients, 1+ per accountant)
  ├── Plans (subscription tier)
  └── AuditLogs

Business
  ├── BankImports (file uploads)
  ├── Transactions (expenses)
  ├── Categories (chart of accounts)
  └── ClassificationRules (keyword-based)
```

### Key Features

1. **Multi-Tenancy**: All data scoped by `accountantId` and `businessId`
2. **Role-Based Access**: Users linked to businesses with role (`OWNER`, `MANAGER`, `VIEWER`)
3. **Transaction Workflow**: PENDING → CLASSIFIED → APPROVED → Report
4. **Flexible Deductibility**: YES (100%), NO (0%), FIFTY (50%)
5. **Audit Trail**: Track who classified, approved, when, and via which method (AI/RULE/MANUAL)
6. **Classification Methods**: AI (Claude), RULE (keyword), MANUAL (user)
7. **Subscription Plans**: BASIC, PLUS, ENTERPRISE with feature limits

### Indexes & Performance

- Foreign keys indexed
- Multi-tenant uniqueness constraints
- Composite indexes on common queries
- Soft deletes for compliance

---

## Migration Strategy (Phase 3 onwards)

### 1. PostgreSQL Setup
```bash
# Create local PostgreSQL database
createdb ismcategorizacion_dev

# Or on Railway:
# Create PostgreSQL 14+ service via Railway dashboard
# Link DATABASE_URL to Next.js app
```

### 2. Prisma Setup
```bash
cd ISMCATEGORIZACION_NextJS
npm install

# Create schema
npx prisma migrate dev --name init

# View database GUI
npx prisma studio
```

### 3. Data Migration (if needed)

#### From old SQLite → PostgreSQL

**Source**: `/home/user/ISMCATEGORIZACION/app/data/users.db`

**Steps**:
1. Export users from SQLite
2. Create 1 Accountant record
3. Create 1 Business record (default)
4. Migrate Users → assign to Business as OWNER
5. Create default Categories (from AI prompt rules)
6. Create default ClassificationRules

**SQL Example**:
```sql
-- Create first accountant
INSERT INTO accountants (id, name, email)
VALUES ('acct_001', 'ISM Consulting Services', 'admin@ismtaxes.com');

-- Create first business
INSERT INTO businesses (id, accountantId, name, industry, entityType)
VALUES ('biz_001', 'acct_001', 'Default Business', 'Other', 'Sole Proprietor (Schedule C)');

-- Migrate users
INSERT INTO users (id, accountantId, email, passwordHash, isActive)
SELECT id, 'acct_001', email, password_hash, is_active
FROM users;

-- Assign users to business
INSERT INTO users_businesses (userId, businessId, role)
SELECT id, 'biz_001', 'OWNER'
FROM users;
```

### 4. API Implementation

Routes to implement (following Next.js 14 patterns):

```
/app/api/
├── auth/
│   ├── register.ts
│   ├── login.ts
│   └── logout.ts
├── businesses/
│   ├── [id]/route.ts (GET, PUT)
│   └── route.ts (GET, POST)
├── transactions/
│   ├── [id]/route.ts (GET, PUT)
│   ├── route.ts (GET, POST)
│   └── import/route.ts (POST - file upload)
├── classifications/
│   ├── batch.ts (POST - AI classification)
│   └── summary.ts (GET - category summary)
└── rules/
    ├── [id]/route.ts (GET, PUT, DELETE)
    └── route.ts (GET, POST)
```

### 5. Frontend Implementation

Components to build:
- Authentication (login, register, profile)
- Business selector / switcher
- File upload (drag-drop, progress)
- Transaction table (sortable, filterable, paginated)
- Classification view (approve/reject)
- Summary/reporting
- Rules management
- User management (admin only)

### 6. Classification Engine (Port from Python)

**Source Logic**: `ai-classification-reference.md`

**Implement in Node.js**:
1. File parsing (CSV, XLSX, PDF → node-xlsx, papaparse, pdf-parse)
2. Transaction filtering (same keyword lists)
3. Batched Claude API calls (via `anthropic` npm package)
4. Fallback keyword matching (same logic)
5. Excel generation (exceljs or similar)

---

## Current File Structure

```
ISMCATEGORIZACION_NextJS/
├── .env.example
├── .gitignore
├── README.md
├── SCHEMA.md
├── MIGRATION_PLAN.md
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── db.ts
│   └── types/
│       └── index.ts
└── prisma/
    └── schema.prisma
```

---

## Questions for Review

Before proceeding to Phase 4 (Implementation), please confirm:

1. **Schema**: Does the multi-tenant structure look correct?
   - Should Accountant → Business be 1:1 or 1:N? (Currently 1:N)
   - Are the enums and fields sufficient?
   - Any missing relationships or tables?

2. **Roles**: Are OWNER, MANAGER, VIEWER sufficient? Or need more granular permissions?

3. **Deductibility**: Is YES/NO/FIFTY sufficient, or need custom percentages?

4. **Classification Method**: Should we track RULE differently (with ruleId reference)?

5. **File Upload**: Should BankImport store raw file data or just metadata?

6. **API Design**: REST or GraphQL preferred?

7. **Auth**: NextAuth.js with Credentials provider, or integrate with third-party (Google, Microsoft)?

8. **Deployment Target**: Railway? Vercel? Self-hosted?

---

## Next Steps After Approval

### Phase 3: Seed Data & Migrations
- Create `prisma/seed.ts`
- Add sample accountants, businesses, users, categories
- Run migrations

### Phase 4: Authentication
- Implement NextAuth.js setup
- Create login/register pages
- Implement role-based middleware

### Phase 5: Core API Routes
- Implement `/api/businesses/` routes
- Implement `/api/transactions/` routes
- Implement file upload handling

### Phase 6: Classification Engine
- Port AI prompt to Node.js
- Implement file parsing (CSV, XLSX, PDF)
- Implement Claude API integration
- Implement fallback keyword matching

### Phase 7: Frontend UI
- Dashboard layout (with role-based nav)
- File upload component
- Transaction table
- Classification approval flow
- Summary/reporting

### Phase 8: Testing & Deployment
- Unit tests (Jest)
- E2E tests (Playwright)
- Deploy to Railway/Vercel
- Set up monitoring and logging

---

## Cost Estimates

### Infrastructure (Monthly)
- PostgreSQL (Railway): ~$10-50
- Next.js App (Railway/Vercel): ~$10-30
- AI API (Claude): ~$0.50-5 per 1000 transactions

### Development Time (Estimate)
- Phase 3-4: 8-10 hours
- Phase 5-6: 16-20 hours
- Phase 7: 24-32 hours
- Phase 8: 8-12 hours

**Total**: ~56-74 hours (2-3 weeks for one developer)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Data loss during migration | HIGH | Backup SQLite before migration, test import script |
| Breaking existing users | HIGH | Run shadow migration first, zero-downtime deployment |
| Schema redesign needed mid-way | MEDIUM | Build migrations, use soft deletes |
| AI API costs spike | MEDIUM | Implement rate limiting, batch processing, caching |
| PostgreSQL connection pooling | MEDIUM | Use Railway's built-in pooling or PgBouncer |

---

## Approval Checklist

- [ ] Schema design approved
- [ ] Roles and permissions model approved
- [ ] API design pattern approved
- [ ] Authentication strategy approved
- [ ] File upload strategy approved
- [ ] Deployment target confirmed
- [ ] Data migration plan approved
- [ ] Ready to proceed with Phase 3 (Seed Data)

---

## Questions or Changes?

Before running any migrations or installing dependencies, please review the schema and let me know:

1. Any entities to add/remove?
2. Any field changes?
3. Any relationship changes?
4. Deployment and auth preferences?

Once approved, run:
```bash
cd ISMCATEGORIZACION_NextJS
npm install
npx prisma migrate dev --name init
npm run dev
```
