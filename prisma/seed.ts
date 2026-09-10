import { PrismaClient, AccountType, Plan, Role, TxType, TxStatus, Deductibility, ClassMethod } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { SYSTEM_CATEGORIES, SystemCategorySeed, systemCategoryId } from '../lib/system-categories'

const prisma = new PrismaClient()

async function upsertSystemCategory(c: SystemCategorySeed) {
  const id = systemCategoryId(c.name)
  return prisma.category.upsert({
    where: { id },
    update: {},
    create: { id, name: c.name, irsCode: c.irsCode, country: c.country, vatRate: c.vatRate || null, isSystem: true },
  })
}

async function main() {
  console.log('🌱 Seeding database...')

  // System categories
  const catMap: Record<string, string> = {}
  for (const c of SYSTEM_CATEGORIES) {
    const cat = await upsertSystemCategory(c)
    catMap[c.name] = cat.id
  }
  console.log('✓ System categories created')

  // SUPERADMIN
  const superAdminHash = await bcrypt.hash('SuperAdmin123!', 12)
  await prisma.user.upsert({
    where: { email: 'superadmin@mypnl.com' },
    update: { passwordHash: superAdminHash, isActive: true, accountType: AccountType.SUPERADMIN },
    create: {
      email: 'superadmin@mypnl.com',
      passwordHash: superAdminHash,
      name: 'Super Admin',
      accountType: AccountType.SUPERADMIN,
      accountRole: 'OWNER',
      isActive: true,
      billingAccount: { create: { plan: Plan.ENTERPRISE } },
    },
  })
  console.log('✓ Superadmin: superadmin@mypnl.com / SuperAdmin123!')

  // CONTADOR demo (plan PLUS, 2 businesses)
  const contadorHash = await bcrypt.hash('password123', 12)
  const contador = await prisma.user.upsert({
    where: { email: 'contador@demo.com' },
    update: { passwordHash: contadorHash, isActive: true },
    create: {
      email: 'contador@demo.com',
      passwordHash: contadorHash,
      name: 'Carlos Contable',
      accountType: AccountType.ACCOUNTANT,
      accountRole: 'OWNER',
      isActive: true,
      billingAccount: { create: { name: 'Contable & Asociados LLC', plan: Plan.PLUS } },
    },
  })
  console.log('✓ Contador: contador@demo.com / password123')

  // Business 1 del contador
  const biz1 = await prisma.business.upsert({
    where: { id: 'biz_restaurant_demo' },
    update: {},
    create: {
      id: 'biz_restaurant_demo',
      name: 'La Buena Mesa Restaurant',
      industry: 'Food Service & Restaurants',
      entityType: 'LLC',
      taxYear: 2025,
    },
  })
  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: contador.id, businessId: biz1.id } },
    update: {},
    create: { userId: contador.id, businessId: biz1.id, role: Role.OWNER },
  })

  // Business 2 del contador
  const biz2 = await prisma.business.upsert({
    where: { id: 'biz_retail_demo' },
    update: {},
    create: {
      id: 'biz_retail_demo',
      name: 'Tech Supply Store',
      industry: 'Retail Trade',
      entityType: 'S-Corp',
      taxYear: 2025,
    },
  })
  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: contador.id, businessId: biz2.id } },
    update: {},
    create: { userId: contador.id, businessId: biz2.id, role: Role.OWNER },
  })
  console.log('✓ 2 businesses created for contador')

  // USUARIO demo con plan BASIC y 1 business
  const individualHash = await bcrypt.hash('password123', 12)
  const individual = await prisma.user.upsert({
    where: { email: 'usuario@demo.com' },
    update: { passwordHash: individualHash, isActive: true },
    create: {
      email: 'usuario@demo.com',
      passwordHash: individualHash,
      name: 'Maria Emprendedora',
      accountType: AccountType.ACCOUNTANT,
      accountRole: 'OWNER',
      isActive: true,
      billingAccount: { create: { plan: Plan.BASIC } },
    },
  })
  console.log('✓ Usuario demo: usuario@demo.com / password123')

  const biz3 = await prisma.business.upsert({
    where: { id: 'biz_boutique_demo' },
    update: {},
    create: {
      id: 'biz_boutique_demo',
      name: 'Boutique Maria',
      industry: 'Retail Trade',
      entityType: 'Sole Proprietor (Schedule C)',
      taxYear: 2025,
    },
  })
  await prisma.businessUser.upsert({
    where: { userId_businessId: { userId: individual.id, businessId: biz3.id } },
    update: {},
    create: { userId: individual.id, businessId: biz3.id, role: Role.OWNER },
  })
  console.log('✓ 1 business created for individual user')

  // Sample transactions for biz1 (restaurant) — only if empty
  const biz1TxCount = await prisma.transaction.count({ where: { businessId: biz1.id } })
  const biz1Txs = biz1TxCount > 0 ? [] : [
    { date: new Date('2025-01-05'), description: 'Google Ads - January', amount: 450, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Advertising'], deductibility: Deductibility.YES, method: ClassMethod.AI },
    { date: new Date('2025-01-10'), description: 'Restaurant Supply Co - Kitchen Equipment', amount: 1250, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Supplies'], deductibility: Deductibility.YES, method: ClassMethod.MANUAL },
    { date: new Date('2025-01-15'), description: 'ConEd Electric Bill', amount: 380.50, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Utilities'], deductibility: Deductibility.YES, method: ClassMethod.AI },
    { date: new Date('2025-01-20'), description: 'Sales Revenue - Week 3', amount: 8900, type: TxType.CREDIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Business Income'], deductibility: Deductibility.NO, method: ClassMethod.MANUAL },
    { date: new Date('2025-02-01'), description: 'Payroll - Feb 1-15', amount: 4500, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Wages'], deductibility: Deductibility.YES, method: ClassMethod.RULE },
    { date: new Date('2025-02-10'), description: 'Sysco Food Distributors', amount: 2100, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Cost of Goods Sold'], deductibility: Deductibility.YES, method: ClassMethod.AI },
    { date: new Date('2025-02-15'), description: 'Sales Revenue - Week 7', amount: 9200, type: TxType.CREDIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Business Income'], deductibility: Deductibility.NO, method: ClassMethod.MANUAL },
    { date: new Date('2025-03-01'), description: 'Amazon Business - Cleaning Supplies', amount: 89.99, type: TxType.DEBIT, status: TxStatus.PENDING },
    { date: new Date('2025-03-05'), description: 'Uber Eats Commission Fee', amount: 234, type: TxType.DEBIT, status: TxStatus.PENDING },
    { date: new Date('2025-03-10'), description: 'Chase Business Checking - Transfer', amount: 500, type: TxType.DEBIT, status: TxStatus.NEEDS_REVIEW },
  ]
  for (const tx of biz1Txs as any[]) {
    await prisma.transaction.create({ data: { ...tx, businessId: biz1.id, sourceFile: 'seed' } })
  }

  // Sample transactions for biz2 (tech retail) — only if empty
  const biz2TxCount = await prisma.transaction.count({ where: { businessId: biz2.id } })
  const biz2Txs = biz2TxCount > 0 ? [] : [
    { date: new Date('2025-01-08'), description: 'Facebook Ads Campaign', amount: 600, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Advertising'], deductibility: Deductibility.YES, method: ClassMethod.AI },
    { date: new Date('2025-01-12'), description: 'Office Depot - Office Supplies', amount: 234, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Office Expenses'], deductibility: Deductibility.YES, method: ClassMethod.AI },
    { date: new Date('2025-01-18'), description: 'Product Sales - January', amount: 15400, type: TxType.CREDIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Business Income'], deductibility: Deductibility.NO, method: ClassMethod.MANUAL },
    { date: new Date('2025-02-05'), description: 'AT&T Business Internet', amount: 149, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Utilities'], deductibility: Deductibility.YES, method: ClassMethod.RULE },
    { date: new Date('2025-02-20'), description: 'Product Sales - February', amount: 18200, type: TxType.CREDIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Business Income'], deductibility: Deductibility.NO, method: ClassMethod.MANUAL },
    { date: new Date('2025-03-01'), description: 'Warehouse Rent', amount: 2800, type: TxType.DEBIT, status: TxStatus.PENDING },
    { date: new Date('2025-03-08'), description: 'Inventory Purchase - Q1', amount: 8500, type: TxType.DEBIT, status: TxStatus.PENDING },
  ]
  for (const tx of biz2Txs as any[]) {
    await prisma.transaction.create({ data: { ...tx, businessId: biz2.id, sourceFile: 'seed' } })
  }

  // Sample transactions for biz3 (boutique) — only if empty
  const biz3TxCount = await prisma.transaction.count({ where: { businessId: biz3.id } })
  const biz3Txs = biz3TxCount > 0 ? [] : [
    { date: new Date('2025-01-06'), description: 'Instagram Ads', amount: 200, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Advertising'], deductibility: Deductibility.YES, method: ClassMethod.AI },
    { date: new Date('2025-01-14'), description: 'Clothing Inventory', amount: 3200, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Cost of Goods Sold'], deductibility: Deductibility.YES, method: ClassMethod.MANUAL },
    { date: new Date('2025-01-22'), description: 'Sales Revenue - January', amount: 5800, type: TxType.CREDIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Business Income'], deductibility: Deductibility.NO, method: ClassMethod.MANUAL },
    { date: new Date('2025-02-03'), description: 'Shopify Monthly Fee', amount: 79, type: TxType.DEBIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Office Expenses'], deductibility: Deductibility.YES, method: ClassMethod.RULE },
    { date: new Date('2025-02-18'), description: 'Sales Revenue - February', amount: 6200, type: TxType.CREDIT, status: TxStatus.CLASSIFIED, categoryId: catMap['Business Income'], deductibility: Deductibility.NO, method: ClassMethod.MANUAL },
    { date: new Date('2025-03-02'), description: 'UPS Shipping Supplies', amount: 145, type: TxType.DEBIT, status: TxStatus.PENDING },
    { date: new Date('2025-03-09'), description: 'Square Payment Processing Fee', amount: 87, type: TxType.DEBIT, status: TxStatus.PENDING },
  ]
  for (const tx of biz3Txs as any[]) {
    await prisma.transaction.create({ data: { ...tx, businessId: biz3.id, sourceFile: 'seed' } })
  }

  console.log('✓ Sample transactions created')
  console.log('\n✅ Seed complete!')
  console.log('\nCredentials:')
  console.log('  Superadmin:  superadmin@mypnl.com / SuperAdmin123!')
  console.log('  Contador:    contador@demo.com / password123')
  console.log('  Individual:  usuario@demo.com / password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
