import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/financials/expenses
 * List expenses
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

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 }
      );
    }

    // Get or create financials
    let financials = await prisma.financials.findUnique({
      where: { companyHQId },
    });

    if (!financials) {
      financials = await prisma.financials.create({
        data: { companyHQId },
      });
    }

    const expenses = await prisma.expenses.findMany({
      where: { financialsId: financials.id },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({
      success: true,
      expenses,
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/financials/expenses
 * Create expense
 */
export async function POST(request) {
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
    const body = await request.json();
    const { companyHQId, date, amount, description, category, vendor } = body;

    if (!companyHQId || !date || !amount || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get or create financials
    let financials = await prisma.financials.findUnique({
      where: { companyHQId },
    });

    if (!financials) {
      financials = await prisma.financials.create({
        data: { companyHQId },
      });
    }

    const expense = await prisma.expenses.create({
      data: {
        financialsId: financials.id,
        date: new Date(date),
        amount: Math.round(amount * 100), // Convert to cents
        description,
        category,
        vendor,
      },
    });

    return NextResponse.json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error('Create expense error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create expense' },
      { status: 500 }
    );
  }
}
