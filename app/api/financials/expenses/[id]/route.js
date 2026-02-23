import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/financials/expenses/[id]
 * Update expense
 */
export async function PUT(request, { params }) {
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
    const { id } = params;
    const body = await request.json();
    const { date, amount, description, category, vendor } = body;

    const expense = await prisma.expenses.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(amount !== undefined && { amount: Math.round(amount * 100) }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(vendor !== undefined && { vendor }),
      },
    });

    return NextResponse.json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error('Update expense error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update expense' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/financials/expenses/[id]
 * Delete expense
 */
export async function DELETE(request, { params }) {
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
    const { id } = params;

    await prisma.expenses.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
