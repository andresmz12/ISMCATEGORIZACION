import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const accountantId = (session.user as any).accountantId;

    // Get all businesses for this user's accountant
    const businesses = await prisma.business.findMany({
      where: { accountantId },
      include: {
        users: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: businesses.map((b) => ({
          id: b.id,
          name: b.name,
          industry: b.industry,
          entityType: b.entityType,
          taxYear: b.taxYear,
          transactionCount: b._count.transactions,
          subscription: b.subscription
            ? { plan: b.subscription.plan.type, status: b.subscription.status }
            : null,
          users: b.users.map((ub) => ({
            id: ub.user.id,
            email: ub.user.email,
            name: ub.user.name,
            role: ub.role,
          })),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/businesses error:", error);
    return NextResponse.json(
      { error: "Failed to fetch businesses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountantId = (session.user as any).accountantId;
    const body = await request.json();

    const { name, industry, entityType, taxYear } = body;

    if (!name) {
      return NextResponse.json({ error: "Business name required" }, { status: 400 });
    }

    // Check subscription limits
    const subscription = await prisma.subscription.findUnique({
      where: { accountantId },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: "No active subscription" }, { status: 403 });
    }

    const currentBusinessCount = await prisma.business.count({
      where: { accountantId },
    });

    if (currentBusinessCount >= subscription.plan.maxBusinesses) {
      return NextResponse.json(
        { error: `Subscription limit: max ${subscription.plan.maxBusinesses} businesses` },
        { status: 403 }
      );
    }

    // Create business
    const business = await prisma.business.create({
      data: {
        accountantId,
        subscriptionId: subscription.id,
        name,
        industry: industry || "Other",
        entityType: entityType || "Sole Proprietor (Schedule C)",
        taxYear: taxYear || new Date().getFullYear(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: business,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/businesses error:", error);
    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}
