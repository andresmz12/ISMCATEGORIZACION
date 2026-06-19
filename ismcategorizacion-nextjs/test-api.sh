#!/bin/bash

# Test script for ISM Categorización API
# This script tests the API endpoints after migrations are run

API_URL="http://localhost:3000"
DEMO_EMAIL="owner@demo.com"
DEMO_PASSWORD="password123"

echo "🧪 ISM Categorización API Test Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Login
echo -e "${YELLOW}Test 1: Login${NC}"
echo "POST $API_URL/api/auth/callback/credentials"
echo "Payload: { email: '$DEMO_EMAIL', password: '$DEMO_PASSWORD' }"
echo ""
echo "Expected: JWT token in response"
echo ""

# Test 2: Get Businesses
echo -e "${YELLOW}Test 2: Get Businesses${NC}"
echo "GET $API_URL/api/businesses"
echo "Headers: Authorization: Bearer <token>"
echo ""
echo "Expected response:"
cat << 'EOF'
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
      "subscription": {
        "plan": "PLUS",
        "status": "ACTIVE"
      },
      "users": [...]
    }
  ]
}
EOF
echo ""

# Test 3: Get Transactions
echo -e "${YELLOW}Test 3: Get Transactions${NC}"
echo "GET $API_URL/api/transactions?businessId=<id>&status=PENDING&limit=10&offset=0"
echo "Headers: Authorization: Bearer <token>"
echo ""
echo "Expected response:"
cat << 'EOF'
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "...",
        "date": "2025-01-10T00:00:00Z",
        "description": "Office Supplies Inc",
        "amount": 120.00,
        "status": "PENDING",
        "method": null,
        "deductibility": "NO",
        "category": null,
        "splits": [],
        "attachments": []
      }
    ],
    "pagination": {
      "total": 2,
      "limit": 10,
      "offset": 0,
      "hasMore": false
    }
  }
}
EOF
echo ""

# Test 4: Create Business
echo -e "${YELLOW}Test 4: Create Business${NC}"
echo "POST $API_URL/api/businesses"
echo "Headers: Authorization: Bearer <token>"
echo "Payload:"
cat << 'EOF'
{
  "name": "New Startup Inc",
  "industry": "Technology",
  "entityType": "LLC",
  "taxYear": 2025
}
EOF
echo ""
echo "Expected: 201 Created with business object"
echo ""

# Summary
echo -e "${GREEN}======================================"
echo "Setup Instructions:${NC}"
echo ""
echo "1. Setup PostgreSQL database:"
echo "   - Create a PostgreSQL database on Railway (or local)"
echo "   - Update .env with DATABASE_URL"
echo ""
echo "2. Run Prisma migrations:"
echo "   \`npx prisma migrate dev --name init\`"
echo ""
echo "3. Seed test data:"
echo "   \`npm run db:seed\`"
echo ""
echo "4. Start dev server:"
echo "   \`npm run dev\`"
echo ""
echo "5. Test login endpoint:"
echo "   \`curl -X POST http://localhost:3000/api/auth/callback/credentials -H 'Content-Type: application/json' -d '{\"email\":\"owner@demo.com\",\"password\":\"password123\"}'\`"
echo ""
echo "6. Copy JWT token and test other endpoints"
echo ""
