import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;

    const products = await prisma.product.findMany({
      where: companyHQId ? { companyHQId } : undefined,
      select: {
        id: true,
        companyHQId: true,
        name: true,
        valueProp: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('❌ Products GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      description = null,
      valueProp = null,
      companyHQId,
    } = body ?? {};

    const tenantId = companyHQId || DEFAULT_COMPANY_HQ_ID;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({
      data: {
        companyHQId: tenantId,
        name,
        description,
        valueProp,
      },
      select: {
        id: true,
        companyHQId: true,
        name: true,
        description: true,
        valueProp: true,
        createdAt: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('❌ Product POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 },
    );
  }
}

