import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runEcosystemOrgInference } from "@/lib/services/ecosystemOrgInference";
import { EcosystemOrgSchema } from "@/lib/schemas/EcosystemOrgSchema";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    const formData = await req.formData();

    // File upload path (CSV/XLSX)
    const file = formData.get("file") as File | null;

    let rawItems: Array<{ name: string; website?: string; city?: string; state?: string }> = [];

    // 1. Parse file upload
    if (file) {
      const buf = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buf, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      rawItems = rows.map((row: any) => ({
        name: row["Firm Name"] || row["Organization"] || row["Name"] || "",
        website: row["Website"] || row["URL"] || null,
        city: row["City"] || null,
        state: row["State"] || null,
      }));
    }

    // 2. Manual text list path (fallback)
    const textList = formData.get("textList") as string | null;
    if (!file && textList) {
      rawItems = textList
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
    }

    if (!rawItems.length) {
      return NextResponse.json(
        { success: false, error: "No valid organizations provided." },
        { status: 400 }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];

    // 3. For each org: infer → validate → save
    for (const item of rawItems) {
      try {
        // 3a. Run AI enrichment
        const inferred = await runEcosystemOrgInference(item);

        // 3b. Validate shape
        const validated = EcosystemOrgSchema.parse(inferred);

        // 3c. Save to DB (create new always for MVP)
        const saved = await prisma.ecosystemOrg.create({
          data: validated,
        });

        results.push(saved);
      } catch (err: any) {
        errors.push({ item, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      orgs: results,
      errors,
    });
  } catch (err: any) {
    console.error("INGEST ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
