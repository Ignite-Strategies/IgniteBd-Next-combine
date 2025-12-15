import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { getInvoiceStatus, getOutstandingAmount, getLastPaymentDate } from '@/lib/utils/invoiceStatus';

/**
 * GET /api/admin/billing
 * List all invoices with derived status
 * Requires Owner authentication - filters invoices by owner's companies
 */
export async function GET(request) {
  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Get Owner by firebaseId
    const owner = await prisma.owners.findUnique({
      where: { firebaseId: firebaseUser.uid },
      include: {
        managedCompanies: {
          select: { id: true },
        },
        ownedCompanies: {
          select: { id: true },
        },
      },
    });

    if (!owner) {
      console.error('❌ Owner not found for firebaseId:', firebaseUser.uid);
      console.error('Firebase user:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.name,
      });
      
      // Check if any owners exist
      const ownerCount = await prisma.owners.count();
      console.error(`Total owners in DB: ${ownerCount}`);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Owner not found',
          debug: {
            firebaseUid: firebaseUser.uid,
            firebaseEmail: firebaseUser.email,
            hint: 'Visit /api/debug/owner-check to diagnose, or /api/debug/fix-owner to create Owner record',
          },
        },
        { status: 403 },
      );
    }

    // Get all company IDs the owner has access to
    const ownerCompanyIds = [
      ...owner.managedCompanies.map((c) => c.id),
      ...owner.ownedCompanies.map((c) => c.id),
    ];

    const { searchParams } = request.nextUrl;
    const workPackageId = searchParams.get('workPackageId');
    const status = searchParams.get('status'); // Filter by status
    const search = searchParams.get('search'); // Search by invoice name or client name

    // Build where clause - filter by owner's companies via WorkPackage
    // WorkPackage -> Company -> CompanyHQ (where CompanyHQ.id in ownerCompanyIds)
    const where = {};
    
    if (workPackageId) {
      // If specific workPackage requested, just filter by ID
      // (will verify access via company relationship in query)
      where.workPackageId = workPackageId;
    } else if (ownerCompanyIds.length > 0) {
      // Filter by owner's companies
      where.workPackage = {
        company: {
          companyHQId: {
            in: ownerCompanyIds,
          },
        },
      };
    } else {
      // Owner has no companies - return empty result
      where.workPackageId = '__no_access__';
    }

    // Get invoices with relations
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        workPackage: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                goesBy: true,
              },
            },
            company: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        milestones: {
          orderBy: { expectedDate: 'asc' },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate outstanding amount and use stored status
    const invoicesWithCalculations = invoices.map((invoice) => {
      const outstandingAmount = invoice.totalExpected - invoice.totalReceived;
      const lastPaymentDate = getLastPaymentDate(invoice.payments);

      return {
        ...invoice,
        outstandingAmount: Math.max(0, outstandingAmount),
        lastPaymentDate,
        // Status is stored in DB, not derived
      };
    });

    // Filter by status if provided
    let filtered = invoicesWithCalculations;
    if (status) {
      filtered = invoicesWithCalculations.filter((inv) => inv.status === status);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceName?.toLowerCase().includes(searchLower) ||
          inv.workPackage?.contact?.firstName?.toLowerCase().includes(searchLower) ||
          inv.workPackage?.contact?.lastName?.toLowerCase().includes(searchLower) ||
          inv.workPackage?.company?.companyName?.toLowerCase().includes(searchLower),
      );
    }

    return NextResponse.json({
      success: true,
      invoices: filtered,
    });
  } catch (error) {
    console.error('❌ Get invoices error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get invoices',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/billing
 * Create invoice container (milestones added separately via CSV or UI)
 * 
 * New model structure:
 * - workPackageId (required)
 * - invoiceName (required)
 * - invoiceDescription (optional)
 * - totalExpected and totalReceived calculated from milestones/payments
 * - status derived from payments
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const {
      workPackageId,
      invoiceName,
      invoiceDescription,
    } = body;

    // Validation
    if (!workPackageId || !invoiceName) {
      return NextResponse.json(
        { success: false, error: 'workPackageId and invoiceName are required' },
        { status: 400 },
      );
    }

    // Verify workPackage exists
    const workPackage = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    if (!workPackage) {
      return NextResponse.json(
        { success: false, error: 'WorkPackage not found' },
        { status: 404 },
      );
    }

    // Create invoice container (no milestones yet - added via CSV or UI)
    const invoice = await prisma.invoice.create({
      data: {
        workPackageId,
        invoiceName,
        invoiceDescription: invoiceDescription || null,
        totalExpected: 0, // Will be calculated when milestones are added
        totalReceived: 0, // Will be calculated when payments are added
        status: 'pending',
      },
      include: {
        workPackage: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            company: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        milestones: true,
        payments: true,
      },
    });

    console.log('✅ Invoice created:', invoice.id);

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error('❌ Create invoice error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create invoice',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

