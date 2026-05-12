import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCsv } from "@/lib/catalogue/import/csv-parser";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  const { supplierId } = await params;
  const supabase = await createClient();

  let content: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    content = await (file as File).text();
  } catch {
    return NextResponse.json({ error: "Impossible de lire le fichier" }, { status: 400 });
  }

  const { products, errors, skipped } = parseCsv(content);

  if (products.length === 0) {
    return NextResponse.json({ error: errors[0] ?? "Aucun produit valide trouvé" }, { status: 400 });
  }

  // Resolve category slugs
  const { data: categories } = await supabase
    .from("material_categories")
    .select("id, slug");
  const catMap = Object.fromEntries((categories ?? []).map((c) => [c.slug, c.id]));

  const now = new Date().toISOString();
  const rows = products.map((p) => ({
    supplier_id: supplierId,
    category_id: p.category_slug ? (catMap[p.category_slug] ?? null) : null,
    reference: p.reference ?? null,
    name: p.name,
    description: p.description ?? null,
    unit: p.unit,
    unit_price_ht: p.unit_price_ht ?? null,
    source: "csv_import" as const,
    price_updated_at: p.unit_price_ht != null ? now : null,
    updated_at: now,
  }));

  // Create job record
  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({
      supplier_id: supplierId,
      status: "completed",
      source_type: "csv",
      products_found: products.length,
      products_updated: products.length,
      started_at: now,
      completed_at: now,
    })
    .select("id")
    .single();

  // Upsert in chunks
  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);

    // Check which references already exist
    const refs = chunk.filter((r) => r.reference).map((r) => r.reference);
    const { data: existing } = refs.length > 0
      ? await supabase
          .from("catalog_products")
          .select("reference")
          .eq("supplier_id", supplierId)
          .in("reference", refs)
      : { data: [] };

    const existingRefs = new Set((existing ?? []).map((e: { reference: string }) => e.reference));

    const { error } = await supabase
      .from("catalog_products")
      .upsert(chunk, { onConflict: "supplier_id,reference", ignoreDuplicates: false });

    if (!error) {
      for (const row of chunk) {
        if (row.reference && existingRefs.has(row.reference)) updated++;
        else inserted++;
      }
    }
  }

  // Update supplier product_count
  const { count } = await supabase
    .from("catalog_products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId);

  await supabase
    .from("suppliers")
    .update({ product_count: count ?? 0, last_scraped_at: now })
    .eq("id", supplierId);

  return NextResponse.json({
    result: { inserted, updated, skipped, errors },
    jobId: job?.id,
  });
}
