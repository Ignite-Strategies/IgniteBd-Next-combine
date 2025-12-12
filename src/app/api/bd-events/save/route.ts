import { NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { saveBDEventOpp } from "@/lib/services/BDEventOppSaveService";
import { transformEventAIToOpp } from "@/lib/mappers/transformEventAIToOpp";

export async function POST(req: Request) {
  try {
    // Verify authentication
    await verifyFirebaseToken(req);
  } catch (error) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { aiEvent, companyHQId, ownerId } = await req.json();

    if (!aiEvent || !companyHQId || !ownerId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const opp = transformEventAIToOpp(aiEvent, companyHQId, ownerId);
    const saved = await saveBDEventOpp(opp);

    return NextResponse.json({ success: true, saved });

  } catch (error: any) {
    console.error("BD Event OPP Save Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

