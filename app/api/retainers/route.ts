import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { generateRetainerSlug } from "@/lib/retainerSlug";

const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.ignitegrowth.biz";

export async function GET(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const retainers = await prisma.company_retainers.findMany({
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, retainers });
  } catch (error) {
    console.error("❌ GET /api/retainers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list retainers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { companyId, name, description, amountCents, currency, startDate } = body ?? {};

    if (!companyId || !name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, error: "companyId and name are required" },
        { status: 400 }
      );
    }
    if (!amountCents || Number(amountCents) <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const company = await prisma.company_hqs.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
    }

    const parsedStartDate =
      startDate && String(startDate).trim()
        ? new Date(String(startDate))
        : null;
    if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid startDate" },
        { status: 400 }
      );
    }

    const created = await prisma.company_retainers.create({
      data: {
        companyId,
        name: String(name).trim(),
        description: description != null ? String(description).trim() || null : null,
        amountCents: Math.round(Number(amountCents)),
        currency: (currency && String(currency).toLowerCase()) || "usd",
        interval: "MONTH",
        startDate: parsedStartDate,
        status: "LINK_SENT",
      },
    });

    const { slug, companySlug, part } = generateRetainerSlug(
      company.companyName,
      created.name,
      created.id
    );
    const publicRetainerUrl = `${APP_DOMAIN}/retainer/${companySlug}/${part}`;

    const retainer = await prisma.company_retainers.update({
      where: { id: created.id },
      data: {
        slug,
        publicRetainerUrl,
      },
      include: {
        company_hqs: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, retainer });
  } catch (error) {
    console.error("❌ POST /api/retainers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create retainer" },
      { status: 500 }
    );
  }
}
