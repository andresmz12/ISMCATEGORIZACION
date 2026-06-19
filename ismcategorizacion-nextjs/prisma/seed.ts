import { PrismaClient, DeductibilityType, PlanType, SubscriptionStatus, TransactionStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...\n");

  // ========================================
  // 1. Create Accountant
  // ========================================
  console.log("📋 Creating Accountant...");
  const accountant = await prisma.accountant.upsert({
    where: { email: "demo@ismconsulting.com" },
    update: {},
    create: {
      name: "Demo Bookkeeping LLC",
      email: "demo@ismconsulting.com",
    },
  });
  console.log(`✅ Accountant created: ${accountant.name}\n`);

  // ========================================
  // 2. Create Plan (Catalog)
  // ========================================
  console.log("💳 Creating Plan...");
  const plan = await prisma.plan.upsert({
    where: { id: "plan-plus-demo" },
    update: {},
    create: {
      id: "plan-plus-demo",
      accountantId: accountant.id,
      type: PlanType.PLUS,
      maxBusinesses: 5,
      maxTransactions: 50000,
      maxUsers: 10,
      maxFileSize: 50,
      includeAI: true,
      pricePerMonth: 9900,
    },
  });
  console.log(`✅ Plan created: ${plan.type}\n`);

  // ========================================
  // 3. Create Subscription
  // ========================================
  console.log("🔄 Creating Subscription...");
  const renewsAt = new Date();
  renewsAt.setMonth(renewsAt.getMonth() + 1);

  const subscription = await prisma.subscription.upsert({
    where: { accountantId: accountant.id },
    update: {},
    create: {
      accountantId: accountant.id,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      renewsAt: renewsAt,
    },
  });
  console.log(`✅ Subscription created: ${subscription.status}\n`);

  // ========================================
  // 4. Create Users
  // ========================================
  console.log("👥 Creating Users...");
  const user1 = await prisma.user.upsert({
    where: { accountantId_email: { accountantId: accountant.id, email: "owner@demo.com" } },
    update: {},
    create: {
      accountantId: accountant.id,
      email: "owner@demo.com",
      name: "Owner User",
      passwordHash: bcrypt.hashSync("password123", 10),
      isActive: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { accountantId_email: { accountantId: accountant.id, email: "manager@demo.com" } },
    update: {},
    create: {
      accountantId: accountant.id,
      email: "manager@demo.com",
      name: "Manager User",
      passwordHash: bcrypt.hashSync("password123", 10),
      isActive: true,
    },
  });
  console.log(`✅ Users created: ${user1.email}, ${user2.email}\n`);

  // ========================================
  // 5. Create Businesses
  // ========================================
  console.log("🏢 Creating Businesses...");
  const business1 = await prisma.business.upsert({
    where: { accountantId_name: { accountantId: accountant.id, name: "Acme Corp Tech" } },
    update: {},
    create: {
      accountantId: accountant.id,
      subscriptionId: subscription.id,
      name: "Acme Corp Tech",
      industry: "Information Technology",
      entityType: "S-Corp",
      taxYear: 2025,
    },
  });

  const business2 = await prisma.business.upsert({
    where: { accountantId_name: { accountantId: accountant.id, name: "Green Consulting" } },
    update: {},
    create: {
      accountantId: accountant.id,
      subscriptionId: subscription.id,
      name: "Green Consulting",
      industry: "Professional Services",
      entityType: "LLC",
      taxYear: 2025,
    },
  });
  console.log(`✅ Businesses created: ${business1.name}, ${business2.name}\n`);

  // ========================================
  // 6. Assign Users to Businesses
  // ========================================
  console.log("🔗 Assigning Users to Businesses...");
  await prisma.userBusiness.upsert({
    where: { userId_businessId: { userId: user1.id, businessId: business1.id } },
    update: {},
    create: { userId: user1.id, businessId: business1.id, role: UserRole.OWNER },
  });

  await prisma.userBusiness.upsert({
    where: { userId_businessId: { userId: user2.id, businessId: business1.id } },
    update: {},
    create: { userId: user2.id, businessId: business1.id, role: UserRole.MANAGER },
  });

  await prisma.userBusiness.upsert({
    where: { userId_businessId: { userId: user1.id, businessId: business2.id } },
    update: {},
    create: { userId: user1.id, businessId: business2.id, role: UserRole.OWNER },
  });
  console.log(`✅ Users assigned to businesses\n`);

  // ========================================
  // 7. Create Chart of Accounts (Categories)
  // ========================================
  console.log("📊 Creating Chart of Accounts...");
  const chartOfAccounts = [
    { code: "6100", name: "Supplies", irsLine: "Schedule C - Line 22", deductibility: DeductibilityType.YES },
    { code: "6200", name: "Rent & Lease", irsLine: "Schedule C - Line 20b", deductibility: DeductibilityType.YES },
    { code: "6300", name: "Wages & Salaries", irsLine: "Schedule C - Line 26", deductibility: DeductibilityType.YES },
    { code: "6400", name: "Marketing & Advertising", irsLine: "Schedule C - Line 8", deductibility: DeductibilityType.YES },
    { code: "6500", name: "Travel", irsLine: "Schedule C - Line 24a", deductibility: DeductibilityType.YES },
    { code: "6600", name: "Meals (50% Deductible)", irsLine: "Schedule C - Line 24b", deductibility: DeductibilityType.FIFTY },
    { code: "6700", name: "Insurance", irsLine: "Schedule C - Line 15", deductibility: DeductibilityType.YES },
    { code: "6800", name: "Professional Services", irsLine: "Schedule C - Line 17", deductibility: DeductibilityType.YES },
    { code: "6900", name: "Equipment", irsLine: "Schedule C - Line 11", deductibility: DeductibilityType.YES },
    { code: "7000", name: "Utilities", irsLine: "Schedule C - Line 25", deductibility: DeductibilityType.YES },
    { code: "7100", name: "Bank & Processing Fees", irsLine: "Schedule C - Line 27a", deductibility: DeductibilityType.YES },
    { code: "7200", name: "Personal (Non-Deductible)", irsLine: "N/A", deductibility: DeductibilityType.NO },
  ];

  const categories: Record<string, any> = {};

  for (const acc of chartOfAccounts) {
    const cat = await prisma.category.upsert({
      where: { businessId_code: { businessId: business1.id, code: acc.code } },
      update: {},
      create: {
        businessId: business1.id,
        code: acc.code,
        name: acc.name,
        irsLine: acc.irsLine,
        deductibility: acc.deductibility,
      },
    });
    categories[acc.code] = cat;
  }

  // Create same categories for business2
  for (const acc of chartOfAccounts) {
    await prisma.category.upsert({
      where: { businessId_code: { businessId: business2.id, code: acc.code } },
      update: {},
      create: {
        businessId: business2.id,
        code: acc.code,
        name: acc.name,
        irsLine: acc.irsLine,
        deductibility: acc.deductibility,
      },
    });
  }
  console.log(`✅ ${chartOfAccounts.length} categories created per business\n`);

  // ========================================
  // 8. Create Classification Rules
  // ========================================
  console.log("⚙️ Creating Classification Rules...");
  const rules = [
    { keyword: "Starbucks", categoryCode: "6600", priority: 10 },
    { keyword: "McDonald", categoryCode: "6600", priority: 10 },
    { keyword: "Shell", categoryCode: "6500", priority: 10 },
    { keyword: "Marriott", categoryCode: "6500", priority: 10 },
    { keyword: "Airbnb", categoryCode: "6500", priority: 10 },
    { keyword: "Uber", categoryCode: "6500", priority: 8 },
    { keyword: "Facebook", categoryCode: "6400", priority: 10 },
    { keyword: "Google Ads", categoryCode: "6400", priority: 10 },
  ];

  for (const rule of rules) {
    const cat = categories[rule.categoryCode];
    if (cat) {
      await prisma.classificationRule.upsert({
        where: { id: `rule-${business1.id}-${rule.keyword}` },
        update: {},
        create: {
          id: `rule-${business1.id}-${rule.keyword}`,
          businessId: business1.id,
          categoryId: cat.id,
          keyword: rule.keyword,
          priority: rule.priority,
          isActive: true,
        },
      });
    }
  }
  console.log(`✅ ${rules.length} classification rules created\n`);

  // ========================================
  // 9. Create Bank Import (File Upload Record)
  // ========================================
  console.log("📁 Creating Bank Import...");
  const bankImport = await prisma.bankImport.create({
    data: {
      businessId: business1.id,
      filename: "chase_export_2025.csv",
      fileType: "csv",
      bankName: "Chase",
      transactionCount: 10,
      mappingUsed: JSON.stringify({
        date: 0,
        description: 1,
        amount: 2,
        type: 3,
      }),
      notes: "Sample import from Chase checking account",
    },
  });
  console.log(`✅ Bank import created: ${bankImport.filename}\n`);

  // ========================================
  // 10. Create Transactions (some PENDING, some CLASSIFIED)
  // ========================================
  console.log("💳 Creating Transactions...");

  const today = new Date();
  const transactions = [
    {
      date: new Date(today.getFullYear(), today.getMonth(), 1),
      description: "Starbucks Coffee",
      amount: 12.5,
      categoryCode: "6600",
      status: TransactionStatus.CLASSIFIED,
      confidence: "HIGH",
    },
    {
      date: new Date(today.getFullYear(), today.getMonth(), 5),
      description: "Shell Gas Station",
      amount: 45.0,
      categoryCode: "6500",
      status: TransactionStatus.CLASSIFIED,
      confidence: "HIGH",
    },
    {
      date: new Date(today.getFullYear(), today.getMonth(), 8),
      description: "Marriott Hotel NYC",
      amount: 250.0,
      categoryCode: "6500",
      status: TransactionStatus.CLASSIFIED,
      confidence: "MEDIUM",
    },
    {
      date: new Date(today.getFullYear(), today.getMonth(), 10),
      description: "Office Supplies Inc",
      amount: 120.0,
      categoryCode: "6100",
      status: TransactionStatus.PENDING,
      confidence: null,
    },
    {
      date: new Date(today.getFullYear(), today.getMonth(), 12),
      description: "Random Vendor",
      amount: 89.99,
      categoryCode: null,
      status: TransactionStatus.PENDING,
      confidence: null,
    },
    {
      date: new Date(today.getFullYear(), today.getMonth(), 15),
      description: "Facebook Ads",
      amount: 500.0,
      categoryCode: "6400",
      status: TransactionStatus.APPROVED,
      confidence: "HIGH",
    },
  ];

  for (const tx of transactions) {
    const category = tx.categoryCode ? categories[tx.categoryCode] : null;

    await prisma.transaction.create({
      data: {
        businessId: business1.id,
        bankImportId: bankImport.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: "DEBIT",
        categoryId: category?.id || null,
        status: tx.status,
        method: tx.status === TransactionStatus.PENDING ? undefined : "AI",
        deductibility: category?.deductibility || DeductibilityType.NO,
        confidence: tx.confidence,
        irsLine: category?.irsLine || null,
        classifiedAt: tx.status !== TransactionStatus.PENDING ? new Date() : null,
      },
    });
  }
  console.log(`✅ ${transactions.length} transactions created\n`);

  // ========================================
  // 11. Create a Transaction with Split
  // ========================================
  console.log("🔄 Creating Transaction with Split...");
  const splitTx = await prisma.transaction.create({
    data: {
      businessId: business1.id,
      bankImportId: bankImport.id,
      date: new Date(today.getFullYear(), today.getMonth(), 20),
      description: "Business Trip - Hotel + Meals",
      amount: 400.0,
      type: "DEBIT",
      categoryId: null,
      status: TransactionStatus.CLASSIFIED,
      method: "MANUAL",
      deductibility: DeductibilityType.YES,
      confidence: "HIGH",
    },
  });

  // Create splits
  const travelCat = categories["6500"];
  const mealsCat = categories["6600"];

  if (travelCat && mealsCat) {
    await prisma.transactionSplit.create({
      data: {
        transactionId: splitTx.id,
        categoryId: travelCat.id,
        amount: 280.0,
        percentage: 70.0,
        deductibility: DeductibilityType.YES,
        notes: "Hotel stay 70%",
      },
    });

    await prisma.transactionSplit.create({
      data: {
        transactionId: splitTx.id,
        categoryId: mealsCat.id,
        amount: 120.0,
        percentage: 30.0,
        deductibility: DeductibilityType.FIFTY,
        notes: "Meals 30% (50% deductible)",
      },
    });
  }
  console.log(`✅ Transaction with split created\n`);

  // ========================================
  // 12. Summary
  // ========================================
  console.log("=" * 60);
  console.log("✅ SEED COMPLETED SUCCESSFULLY\n");
  console.log("📊 Summary:");
  console.log(`   - Accountant: ${accountant.name}`);
  console.log(`   - Subscription: ${subscription.status} (Plan: ${plan.type})`);
  console.log(`   - Businesses: 2 (${business1.name}, ${business2.name})`);
  console.log(`   - Users: 2`);
  console.log(`   - Categories: 12 per business`);
  console.log(`   - Classification Rules: 8`);
  console.log(`   - Transactions: 6 + 1 split = 7 total`);
  console.log("\n📝 Demo Login:");
  console.log(`   Email: owner@demo.com`);
  console.log(`   Password: password123\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
