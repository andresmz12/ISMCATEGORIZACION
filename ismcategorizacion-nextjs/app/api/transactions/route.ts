import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { TransactionStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get("businessId");
    const status = searchParams.get("status") as TransactionStatus | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId query parameter required" },
        { status: 400 }
      );
    }

    // Verify user has access to this business
    const userBusiness = await prisma.userBusiness.findUnique({
      where: {
        userId_businessId: {
          userId: (session.user as any).id,
          businessId,
        },
      },
    });

    if (!userBusiness) {
      return NextResponse.json(
        { error: "Access denied to this business" },
        { status: 403 }
      );
    }

    // Build filter
    const where: any = { businessId };
    if (status) {
      where.status = status;
    }

    // Get transactions
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          category: {
            select: { id: true, code: true, name: true, irsLine: true },
          },
          rule: {
            select: { id: true, keyword: true },
          },
          splits: {
            include: {
              category: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          attachments: {
            select: { id: true, fileUrl: true, fileType: true, fileName: true },
          },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          transactions: transactions.map((tx) => ({
            id: tx.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: tx.type,
            status: tx.status,
            method: tx.method,
            deductibility: tx.deductibility,
            confidence: tx.confidence,
            category: tx.category,
            rule: tx.rule,
            irsLine: tx.irsLine,
            splits: tx.splits,
            attachments: tx.attachments,
            classifiedAt: tx.classifiedAt,
            approvedAt: tx.approvedAt,
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
