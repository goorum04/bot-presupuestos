import { createClient } from "@/lib/supabase/server";
import { GenericHtmlScraper } from "./scrapers/generic-html-scraper";
import { PdfPriceListScraper } from "./scrapers/pdf-price-list-scraper";
import type { ScrapedProduct } from "./scrapers/base-scraper";

export interface CoordinatorResult {
  jobId: string;
  status: "completed" | "failed" | "skipped";
  productsFound: number;
  productsUpdated: number;
  error?: string;
}

export async function runScrape(supplierId: string): Promise<CoordinatorResult> {
  const supabase = await createClient();

  // Load supplier config
  const { data: supplier, error: supErr } = await supabase
    .from("suppliers")
    .select("id, name, catalog_url, scrape_enabled, scraper_config")
    .eq("id", supplierId)
    .single();

  if (supErr || !supplier) {
    return { jobId: "", status: "failed", productsFound: 0, productsUpdated: 0, error: "Fournisseur introuvable" };
  }

  if (!supplier.scrape_enabled || !supplier.catalog_url) {
    return { jobId: "", status: "skipped", productsFound: 0, productsUpdated: 0, error: "Scraping désactivé pour ce fournisseur" };
  }

  // Create job
  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({
      supplier_id: supplierId,
      status: "running",
      source_url: supplier.catalog_url,
      source_type: supplier.catalog_url.endsWith(".pdf") ? "pdf" : "web",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const jobId = job?.id ?? "";

  // Choose scraper
  const isPdf = supplier.catalog_url.toLowerCase().endsWith(".pdf");
  const scraper = isPdf
    ? new PdfPriceListScraper(supplierId, supplier.catalog_url)
    : new GenericHtmlScraper(
        supplierId,
        supplier.catalog_url,
        supplier.scraper_config ?? {
          productList: "tr",
          name: "td:first-child",
          unitStatic: "u",
        }
      );

  const result = await scraper.scrape();

  if (result.error || result.products.length === 0) {
    await supabase
      .from("scrape_jobs")
      .update({
        status: "failed",
        error_message: result.error ?? "Aucun produit trouvé",
        products_found: 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { jobId, status: "failed", productsFound: 0, productsUpdated: 0, error: result.error };
  }

  // Resolve category IDs
  const { data: categories } = await supabase
    .from("material_categories")
    .select("id, slug");
  const catMap = Object.fromEntries((categories ?? []).map((c) => [c.slug, c.id]));

  const updated = await upsertProducts(supabase, supplierId, result.products, catMap, result.source_url);

  // Update supplier
  await supabase
    .from("suppliers")
    .update({
      last_scraped_at: new Date().toISOString(),
      product_count: updated.total,
    })
    .eq("id", supplierId);

  await supabase
    .from("scrape_jobs")
    .update({
      status: "completed",
      products_found: result.products.length,
      products_updated: updated.upserted,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return { jobId, status: "completed", productsFound: result.products.length, productsUpdated: updated.upserted };
}

async function upsertProducts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  supplierId: string,
  products: ScrapedProduct[],
  catMap: Record<string, string>,
  sourceUrl: string
): Promise<{ upserted: number; total: number }> {
  const now = new Date().toISOString();
  const rows = products.map((p) => ({
    supplier_id: supplierId,
    category_id: p.category_slug ? (catMap[p.category_slug] ?? null) : null,
    reference: p.reference ?? null,
    name: p.name,
    description: p.description ?? null,
    unit: p.unit,
    unit_price_ht: p.unit_price_ht ?? null,
    source: "scrape" as const,
    price_updated_at: p.unit_price_ht != null ? now : null,
    updated_at: now,
  }));

  // Batch upsert in chunks of 100
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase
      .from("catalog_products")
      .upsert(chunk, {
        onConflict: "supplier_id,reference",
        ignoreDuplicates: false,
      });
    if (!error) upserted += chunk.length;
  }

  // Get new total
  const { count } = await supabase
    .from("catalog_products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId);

  return { upserted, total: count ?? 0 };
}
