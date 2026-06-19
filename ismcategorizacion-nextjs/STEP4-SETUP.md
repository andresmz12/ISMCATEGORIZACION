# PASO 4: Migraciones, Seed Data, y Primeras Rutas API

## Status: Implementation Complete - Ready for Database Setup

Este documento describe cómo configurar la base de datos y ejecutar el proyecto.

---

## ✅ Completado en esta fase

### 1. Dependencias Instaladas
```bash
npm install
```

**Stack instalado:**
- Next.js 14 + React 18
- Prisma + PostgreSQL
- NextAuth.js
- bcryptjs para password hashing
- TypeScript + ESLint

### 2. Seed Script Creado
**Archivo:** `prisma/seed.ts`

**Datos de prueba:**
- 1 Accountant: "Demo Bookkeeping LLC"
- 1 Plan: PLUS (5 businesses, 50K tx/yr, AI enabled)
- 1 Subscription: ACTIVE
- 2 Businesses: "Acme Corp Tech", "Green Consulting"
- 2 Users: owner@demo.com, manager@demo.com
- 12 Categories per business (Chart of Accounts)
- 8 Classification Rules (keyword-based)
- 7 Transactions (6 individual + 1 with split across 2 categories)
- 1 Bank Import record

**Demo Login:**
```
Email: owner@demo.com
Password: password123
```

### 3. Authentication API
**Archivo:** `app/api/auth/[...nextauth]/route.ts`

**Features:**
- NextAuth.js with Credentials provider
- Email/password authentication
- Password hashing with bcryptjs
- JWT session strategy (8 hours)
- User data includes accountantId and accountantName

**Endpoint:**
```
POST /api/auth/signin
Body: { email, password }
```

### 4. Businesses API
**File:** `app/api/businesses/route.ts`

**Endpoints:**

#### GET /api/businesses
- List all businesses for authenticated user's accountant
- Returns business info, users, subscription, transaction count
- Requires authentication

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Acme Corp Tech",
      "industry": "Information Technology",
      "entityType": "S-Corp",
      "taxYear": 2025,
      "transactionCount": 7,
      "subscription": { "plan": "PLUS", "status": "ACTIVE" },
      "users": [
        { "email": "owner@demo.com", "role": "OWNER" }
      ]
    }
  ]
}
```

#### POST /api/businesses
- Create new business
- Validates subscription limits
- Requires authentication

**Request:**
```json
{
  "name": "New Business",
  "industry": "Technology",
  "entityType": "LLC",
  "taxYear": 2025
}
```

**Response:**
```json
{
  "success": true,
  "data": { "id": "...", "name": "...", ... }
}
```

### 5. Transactions API
**File:** `app/api/transactions/route.ts`

**Endpoint:**

#### GET /api/transactions
- List transactions for a business
- Filterable by status (PENDING, CLASSIFIED, APPROVED, REJECTED)
- Pagination support (limit, offset)
- Includes splits and attachments
- Requires authentication + business access

**Query Parameters:**
```
?businessId=<id>      [Required]
&status=PENDING       [Optional]
&limit=100            [Optional, default 100, max 500]
&offset=0             [Optional]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "...",
        "date": "2025-01-10T00:00:00Z",
        "description": "Starbucks Coffee",
        "amount": 12.50,
        "status": "CLASSIFIED",
        "method": "AI",
        "deductibility": "FIFTY",
        "category": {
          "id": "...",
          "code": "6600",
          "name": "Meals (50% Deductible)",
          "irsLine": "Schedule C - Line 24b"
        },
        "splits": [],
        "attachments": [],
        "confidence": "HIGH"
      }
    ],
    "pagination": {
      "total": 7,
      "limit": 100,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

---

## 📋 Next Steps - Database Setup

### Option A: PostgreSQL Local (Development)

```bash
# 1. Install PostgreSQL (if not already installed)
# macOS:
brew install postgresql

# Linux:
sudo apt-get install postgresql postgresql-contrib

# 2. Start PostgreSQL service
# macOS:
brew services start postgresql

# Linux:
sudo systemctl start postgresql

# 3. Create database
createdb ismcategorizacion_dev

# 4. Update .env
DATABASE_URL="postgresql://localhost:5432/ismcategorizacion_dev"
```

### Option B: PostgreSQL on Railway (Production)

```bash
# 1. Create PostgreSQL service on Railway
#    - Go to railway.app
#    - Create new project
#    - Add PostgreSQL plugin
#    - Copy DATABASE_URL to .env

# 2. .env example:
DATABASE_URL="postgresql://postgres:password@proxy.railway.internal:5432/railway"
```

---

## 🗄️ Running Migrations

```bash
# 1. Run Prisma migrations
npx prisma migrate dev --name init

# This will:
# - Create all tables (accountants, businesses, users, transactions, etc.)
# - Generate Prisma client
# - Show migration status

# 2. Verify database
npx prisma studio
# Opens browser GUI to view all tables
```

---

## 🌱 Seeding Test Data

```bash
# Run seed script
npm run db:seed

# Expected output:
# 🌱 Starting database seed...
# 📋 Creating Accountant...
# ✅ Accountant created: Demo Bookkeeping LLC
# 
# 💳 Creating Plan...
# ✅ Plan created: PLUS
# 
# 🔄 Creating Subscription...
# ✅ Subscription created: ACTIVE
# 
# 👥 Creating Users...
# ✅ Users created: owner@demo.com, manager@demo.com
# 
# 🏢 Creating Businesses...
# ✅ Businesses created: Acme Corp Tech, Green Consulting
# 
# 🔗 Assigning Users to Businesses...
# ✅ Users assigned to businesses
# 
# 📊 Creating Chart of Accounts...
# ✅ 12 categories created per business
# 
# ⚙️ Creating Classification Rules...
# ✅ 8 classification rules created
# 
# 📁 Creating Bank Import...
# ✅ Bank import created: chase_export_2025.csv
# 
# 💳 Creating Transactions...
# ✅ 6 transactions created
# 
# 🔄 Creating Transaction with Split...
# ✅ Transaction with split created
# 
# ✅ SEED COMPLETED SUCCESSFULLY
# 📊 Summary:
#    - Accountant: Demo Bookkeeping LLC
#    - Subscription: ACTIVE (Plan: PLUS)
#    - Businesses: 2 (Acme Corp Tech, Green Consulting)
#    - Users: 2
#    - Categories: 12 per business
#    - Classification Rules: 8
#    - Transactions: 6 + 1 split = 7 total
# 
# 📝 Demo Login:
#    Email: owner@demo.com
#    Password: password123
```

---

## 🚀 Running the Development Server

```bash
# Start Next.js dev server
npm run dev

# Server runs on http://localhost:3000
# Watch for file changes and auto-reload
```

---

## ✅ Testing the APIs

### Using curl

```bash
# 1. Get token via NextAuth (simulated)
# Note: NextAuth uses session cookies, direct credentials call may differ
# For testing, you can manually generate JWT or use NextAuth session

# 2. Get businesses
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/businesses

# 3. Get transactions
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/transactions?businessId=<id>&status=PENDING&limit=10"

# 4. Create business
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Startup","industry":"Tech","entityType":"LLC"}' \
  http://localhost:3000/api/businesses
```

### Using script

```bash
# Run provided test script
bash test-api.sh
```

---

## 🔍 Verifying Everything Works

### 1. Check database connection
```bash
npx prisma db execute --stdin < <(echo "SELECT 1;")
```

### 2. Check seed data
```bash
npx prisma studio
# Navigate to each table and verify data
```

### 3. Check API responses
```bash
# Start server
npm run dev

# In another terminal, test endpoint
curl http://localhost:3000/api/businesses
# Should return 401 Unauthorized (no token)
```

### 4. Check migrations
```bash
ls prisma/migrations/
# Should see timestamp folders with migration.sql files
```

---

## 📊 Database Schema Summary

**Tables created:**
- accountants
- users
- users_businesses
- businesses
- subscriptions
- plans
- categories
- classification_rules
- transactions
- transaction_splits
- attachments
- bank_imports
- bank_format_mappings
- audit_logs

**Total records from seed:**
- 1 accountant
- 2 businesses
- 2 users
- 2 user-business assignments
- 1 subscription
- 1 plan
- 24 categories (12 per business)
- 8 classification rules
- 7 transactions
- 2 transaction splits
- 1 bank import

---

## 🐛 Troubleshooting

### Issue: `DATABASE_URL not set`
**Solution:** Create `.env` file with:
```
DATABASE_URL="postgresql://user:password@localhost:5432/ismcategorizacion_dev"
```

### Issue: `PostgreSQL connection refused`
**Solution:** 
```bash
# Check PostgreSQL is running
psql --version

# Start PostgreSQL (macOS)
brew services start postgresql

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

### Issue: `Migration already exists`
**Solution:**
```bash
# Reset migrations (DEVELOPMENT ONLY - deletes all data)
npx prisma migrate reset
```

### Issue: `Seed script fails`
**Solution:**
```bash
# Ensure migrations ran first
npx prisma migrate dev

# Then run seed
npm run db:seed
```

---

## 📝 What's Implemented

✅ Prisma schema with 10 tables  
✅ NextAuth.js authentication  
✅ GET /api/businesses (list)  
✅ POST /api/businesses (create)  
✅ GET /api/transactions (filterable)  
✅ Seed script with 7 sample transactions  
✅ Transaction splits (1 example)  
✅ Classification rules (8 examples)  
✅ Error handling  
✅ Authorization checks  

---

## 🎯 What's NOT Implemented Yet

❌ File upload endpoint  
❌ AI classification endpoint  
❌ Frontend UI  
❌ Email notifications  
❌ Payment/subscription management  
❌ Advanced reporting  

---

## 📚 Files Created This Phase

```
app/
├── api/
│   ├── auth/[...nextauth]/
│   │   └── route.ts          # NextAuth.js handler
│   ├── businesses/
│   │   └── route.ts          # GET/POST businesses
│   └── transactions/
│       └── route.ts          # GET transactions

prisma/
├── schema.prisma             # (Already created in Phase 3)
└── seed.ts                   # Seed script

.env                          # Environment variables
STEP4-SETUP.md               # This file
test-api.sh                  # API test script
```

---

## Next Phase (Phase 5)

- File upload handling
- AI classification via Claude API
- Frontend dashboard
- Transaction approval workflow
- Reporting and summaries

---

## Commands Quick Reference

```bash
# Install
npm install

# Migrations
npx prisma migrate dev --name init

# Seed data
npm run db:seed

# View DB GUI
npx prisma studio

# Dev server
npm run dev

# Tests (when added)
npm test

# Build
npm run build

# Production
npm run start
```

---

✅ **PASO 4 COMPLETE**

All backend infrastructure is ready. Database setup and testing instructions provided above.
