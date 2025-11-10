import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request, { params }) {
  try {
    const { productId } = params;
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        ...(companyHQId ? { companyHQId } : {}),
      },
      select: {
        id: true,
        companyHQId: true,
        name: true,
        valueProp: true,
        description: true,
        price: true,
        priceCurrency: true,
        targetedTo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('❌ Product GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { productId } = params;
    const body = await request.json();
    const {
      name,
      description = null,
      valueProp = null,
      price = null,
      priceCurrency = 'USD',
      targetedTo = null,
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

    // Check if product exists and belongs to tenant
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        companyHQId: tenantId,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found or does not belong to this tenant' },
        { status: 404 },
      );
    }

    // Update the product
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        description,
        valueProp,
        price,
        priceCurrency: price ? (priceCurrency || 'USD') : null,
        targetedTo,
      },
      select: {
        id: true,
        companyHQId: true,
        name: true,
        description: true,
        valueProp: true,
        price: true,
        priceCurrency: true,
        targetedTo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ product });
  } catch (error) {
    console.error('❌ Product PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 },
    );
  }
}

