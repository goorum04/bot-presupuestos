import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SuggestedProduct } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") ?? null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "3", 10), 10);

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_catalog_products", {
    query_text: q,
    item_type: type,
    result_limit: limit,
  });

  if (error) {
    console.error("[catalogue/suggest]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []) as SuggestedProduct[] });
}
