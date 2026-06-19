import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const SYSTEM_CATEGORIES = [
  { name: 'Advertising', irsCode: 'Schedule C Line 8' },
  { name: 'Car & Truck Expenses', irsCode: 'Schedule C Line 9' },
  { name: 'Commissions & Fees', irsCode: 'Schedule C Line 10' },
  { name: 'Contract Labor', irsCode: 'Schedule C Line 11' },
  { name: 'Depletion', irsCode: 'Schedule C Line 12' },
  { name: 'Depreciation', irsCode: 'Schedule C Line 13' },
  { name: 'Employee Benefits', irsCode: 'Schedule C Line 14' },
  { name: 'Insurance', irsCode: 'Schedule C Line 15' },
  { name: 'Interest - Mortgage', irsCode: 'Schedule C Line 16a' },
  { name: 'Interest - Other', irsCode: 'Schedule C Line 16b' },
  { name: 'Legal & Professional', irsCode: 'Schedule C Line 17' },
  { name: 'Office Expenses', irsCode: 'Schedule C Line 18' },
  { name: 'Pension & Profit Sharing', irsCode: 'Schedule C Line 19' },
  { name: 'Rent - Machinery', irsCode: 'Schedule C Line 20a' },
  { name: 'Rent - Other', irsCode: 'Schedule C Line 20b' },
  { name: 'Repairs & Maintenance', irsCode: 'Schedule C Line 21' },
  { name: 'Supplies', irsCode: 'Schedule C Line 22' },
  { name: 'Taxes & Licenses', irsCode: 'Schedule C Line 23' },
  { name: 'Travel', irsCode: 'Schedule C Line 24a' },
  { name: 'Meals (50%)', irsCode: 'Schedule C Line 24b' },
  { name: 'Utilities', irsCode: 'Schedule C Line 25' },
  { name: 'Wages', irsCode: 'Schedule C Line 26' },
  { name: 'Other Expenses', irsCode: 'Schedule C Line 27a' },
  { name: 'Cost of Goods Sold', irsCode: 'Schedule C Part III' },
  { name: 'Business Income', irsCode: 'Schedule C Line 1' },
  { name: 'Owner Draw / Personal', irsCode: 'Non-Deductible' },
  { name: 'Transfer', irsCode: 'Non-Deductible' },
  { name: 'Uncategorized', irsCode: 'Unclassified' },
]

async function main() {
  console.log('Seeding database...')

  // Create system categories (no businessId)
  for (const cat of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: `sys_${cat.name.replace(/\s+/g, '_').toLowerCase()}` },
      update: {},
      create: {
        id: `sys_${cat.name.replace(/\s+/g, '_').toLowerCase()}`,
        name: cat.name,
        irsCode: cat.irsCode,
        isSystem: true,
      },
    })
  }
  console.log('System categories created.')

  // Create owner user
  const ownerHash = await bcrypt.hash('password123', 12)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      email: 'owner@demo.com',
      passwordHash: ownerHash,
      name: 'Demo Owner',
      role: Role.OWNER,
    },
  })
  console.log('Owner created:', owner.email)

  // Create accountant user
  const acctHash = await bcrypt.hash('password123', 12)
  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@demo.com' },
    update: {},
    create: {
      email: 'accountant@demo.com',
      passwordHash: acctHash,
      name: 'Demo Accountant',
      role: Role.ACCOUNTANT,
    },
  })
  console.log('Accountant created:', accountant.email)

  // Create demo business
  const business = await prisma.business.upsert({
    where: { id: 'demo_business_001' },
    update: {},
    create: {
      id: 'demo_business_001',
      name: 'Demo Restaurant LLC',
      industry: 'Food Service & Restaurants',
      entityType: 'LLC',
      taxYear: 2025,
    },
  })
  console.log('Business created:', business.name)

  // Link owner to business
  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: owner.id, businessId: business.id } },
    update: {},
    create: { userId: owner.id, businessId: business.id, role: 'OWNER' },
  })

  // Link accountant to business
  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: accountant.id, businessId: business.id } },
    update: {},
    create: { userId: accountant.id, businessId: business.id, role: 'ACCOUNTANT' },
  })

  // Get some category IDs for sample transactions
  const advertising = await prisma.category.findFirst({ where: { name: 'Advertising', isSystem: true } })
  const supplies = await prisma.category.findFirst({ where: { name: 'Supplies', isSystem: true } })
  const utilities = await prisma.category.findFirst({ where: { name: 'Utilities', isSystem: true } })
  const income = await prisma.category.findFirst({ where: { name: 'Business Income', isSystem: true } })

  // Create sample transactions
  const sampleTxs = [
    {
      date: new Date('2025-01-05'),
      description: 'Google Ads - January Campaign',
      amount: 450.00,
      type: 'DEBIT' as const,
      status: 'CLASSIFIED' as const,
      categoryId: advertising?.id,
      deductibility: 'YES' as const,
      method: 'MANUAL' as const,
    },
    {
      date: new Date('2025-01-10'),
      description: 'Restaurant Supply Co - Kitchen Equipment',
      amount: 1250.00,
      type: 'DEBIT' as const,
      status: 'CLASSIFIED' as const,
      categoryId: supplies?.id,
      deductibility: 'YES' as const,
      method: 'MANUAL' as const,
    },
    {
      date: new Date('2025-01-15'),
      description: 'ConEd Electric Bill',
      amount: 380.50,
      type: 'DEBIT' as const,
      status: 'CLASSIFIED' as const,
      categoryId: utilities?.id,
      deductibility: 'YES' as const,
      method: 'MANUAL' as const,
    },
    {
      date: new Date('2025-01-20'),
      description: 'Sales Revenue - Week 3',
      amount: 8900.00,
      type: 'CREDIT' as const,
      status: 'CLASSIFIED' as const,
      categoryId: income?.id,
      deductibility: 'NO' as const,
      method: 'MANUAL' as const,
    },
    {
      date: new Date('2025-02-01'),
      description: 'Amazon Business - Cleaning Supplies',
      amount: 89.99,
      type: 'DEBIT' as const,
      status: 'PENDING' as const,
    },
    {
      date: new Date('2025-02-05'),
      description: 'Uber Eats Commission',
      amount: 234.00,
      type: 'DEBIT' as const,
      status: 'PENDING' as const,
    },
    {
      date: new Date('2025-02-10'),
      description: 'Payroll - Feb 1-15',
      amount: 4500.00,
      type: 'DEBIT' as const,
      status: 'PENDING' as const,
    },
  ]

  for (const tx of sampleTxs) {
    await prisma.transaction.create({
      data: {
        ...tx,
        businessId: business.id,
        sourceFile: 'seed',
      },
    })
  }

  console.log('Sample transactions created.')
  console.log('\nSeed complete! Credentials:')
  console.log('  Owner:      owner@demo.com / password123')
  console.log('  Accountant: accountant@demo.com / password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
