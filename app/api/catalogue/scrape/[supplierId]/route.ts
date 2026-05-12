import { NextRequest, NextResponse } from "next/server";
import { runScrape } from "@/lib/catalogue/scrape-coordinator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  const { supplierId } = await params;

  try {
    const result = await runScrape(supplierId);
    const status = result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error("[catalogue/scrape]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
