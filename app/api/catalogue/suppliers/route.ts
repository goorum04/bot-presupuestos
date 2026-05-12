import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select(
      "id, name, city, website, catalog_url, scrape_enabled, last_scraped_at, product_count"
    )
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach last scrape job status per supplier
  const ids = (suppliers ?? []).map((s) => s.id);
  let jobsMap: Record<string, { status: string; completed_at: string | null; error_message: string | null }> = {};

  if (ids.length > 0) {
    const { data: jobs } = await supabase
      .from("scrape_jobs")
      .select("supplier_id, status, completed_at, error_message")
      .in("supplier_id", ids)
      .order("created_at", { ascending: false });

    // Keep only the most recent job per supplier
    for (const job of jobs ?? []) {
      if (!jobsMap[job.supplier_id]) {
        jobsMap[job.supplier_id] = {
          status: job.status,
          completed_at: job.completed_at,
          error_message: job.error_message,
        };
      }
    }
  }

  const enriched = (suppliers ?? []).map((s) => ({
    ...s,
    last_job: jobsMap[s.id] ?? null,
  }));

  return NextResponse.json({ data: enriched });
}
