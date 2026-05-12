import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const status = searchParams.get("status");

  let query = supabase
    .from("devis")
    .select("*, projects(id, name)")
    .order("created_at", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { items, ...devisData } = body;

  // Insert devis
  const { data: devis, error: devisError } = await supabase
    .from("devis")
    .insert({ ...devisData, created_by: user.id })
    .select()
    .single();

  if (devisError) return NextResponse.json({ error: devisError.message }, { status: 500 });

  // Insert items
  if (items?.length > 0) {
    const itemsWithId = items.map((item: Record<string, unknown>, idx: number) => ({
      ...item,
      devis_id: devis.id,
      position: idx,
    }));
    const { error: itemsError } = await supabase.from("devis_items").insert(itemsWithId);
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ data: devis }, { status: 201 });
}
