import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const supplierId = searchParams.get("supplier_id");
  const categoryId = searchParams.get("category_id");
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, parseInt(searchParams.get("page_size") ?? "50", 10));

  const supabase = await createClient();

  let query = supabase
    .from("catalog_products")
    .select(
      "id, supplier_id, category_id, reference, name, description, unit, unit_price_ht, currency, is_available, source, price_updated_at, created_at, updated_at, suppliers(id, name), material_categories(id, name, slug)",
      { count: "exact" }
    )
    .order("name", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (supplierId) query = query.eq("supplier_id", supplierId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (q && q.length >= 2) query = query.ilike("name", `%${q}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, page_size: pageSize });
}
