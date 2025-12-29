import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getProductSelect,
  getProductData,
  validateAndMapRequest,
  mapDatabaseToApi,
} from '@/lib/services/ProductServiceMapper';

const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request, { params }) {
  try {
    const { productId } = params;
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;

    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        ...(companyHQId ? { companyHQId } : {}),
      },
      select: getProductSelect(),
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ product: mapDatabaseToApi(product) });
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
    const { companyHQId } = body ?? {};

    const tenantId = companyHQId || DEFAULT_COMPANY_HQ_ID;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Validate and map request data
    const validation = validateAndMapRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
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

    const productData = getProductData(body);

    // Update the product
      const product = await prisma.products.update({
      where: { id: productId },
      data: productData,
      select: getProductSelect(),
    });

    return NextResponse.json({ product: mapDatabaseToApi(product) });
  } catch (error) {
    console.error('❌ Product PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 },
    );
  }
}

