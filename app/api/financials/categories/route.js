import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/financials/categories
 * Get all categories for autocomplete
 */
export async function GET(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    const type = searchParams.get('type'); // 'expense', 'income', or 'equity'

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Get financials
    const financials = await prisma.financials.findUnique({
      where: { companyHQId },
    });

    if (!financials) {
      return NextResponse.json({
        success: true,
        categories: [],
      });
    }

    let categories = [];

    if (type === 'expense' || !type) {
      const expenseCategories = await prisma.expenses.findMany({
        where: {
          financialsId: financials.id,
          category: { not: null },
        },
        select: { category: true },
        distinct: ['category'],
      });
      categories.push(...expenseCategories.map((e) => e.category));
    }

    if (type === 'income' || !type) {
      const incomeCategories = await prisma.income.findMany({
        where: {
          financialsId: financials.id,
          category: { not: null },
        },
        select: { category: true },
        distinct: ['category'],
      });
      categories.push(...incomeCategories.map((i) => i.category));
    }

    if (type === 'equity' || !type) {
      const equityCategories = await prisma.equity.findMany({
        where: {
          financialsId: financials.id,
          category: { not: null },
        },
        select: { category: true },
        distinct: ['category'],
      });
      categories.push(...equityCategories.map((e) => e.category));
    }

    // Remove duplicates and nulls
    const uniqueCategories = [...new Set(categories.filter(Boolean))].sort();

    return NextResponse.json({
      success: true,
      categories: uniqueCategories,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
