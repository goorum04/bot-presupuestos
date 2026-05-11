import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const projectId = searchParams.get("project_id");
  const status = searchParams.get("status");
  const ocrStatus = searchParams.get("ocr_status");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  let query = supabase
    .from("invoices")
    .select(
      `*, projects(id, name), budget_categories(id, name, slug), profiles!uploaded_by(id, full_name)`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) query = query.eq("project_id", projectId);
  if (status === "validated") query = query.eq("is_validated", true);
  if (status === "pending") query = query.eq("is_validated", false);
  if (ocrStatus) query = query.eq("ocr_status", ocrStatus);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data });
}
