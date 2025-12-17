import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getProductSelect,
  getProductData,
  validateAndMapRequest,
  mapDatabaseToApi,
} from '@/lib/services/ProductServiceMapper';

// TODO WEDNESDAY FIX #2: Products MUST be scoped by companyHQId, never by ownerId
// TODO WEDNESDAY FIX #2: All product queries must use: where: { companyHQId: currentCompanyHQId }
const DEFAULT_COMPANY_HQ_ID = process.env.DEFAULT_COMPANY_HQ_ID || null;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId') || DEFAULT_COMPANY_HQ_ID;

    const products = await prisma.product.findMany({
      where: companyHQId ? { companyHQId } : undefined,
      select: getProductSelect(),
      orderBy: { createdAt: 'desc' },
    });

    // Map to API format
    const mappedProducts = products.map(mapDatabaseToApi);

    return NextResponse.json(mappedProducts);
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

    const productData = getProductData(body);

    const product = await prisma.product.create({
      data: {
        companyHQId: tenantId,
        ...productData,
      },
      select: getProductSelect(),
    });

    return NextResponse.json(mapDatabaseToApi(product), { status: 201 });
  } catch (error) {
    console.error('❌ Product POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 },
    );
  }
}

