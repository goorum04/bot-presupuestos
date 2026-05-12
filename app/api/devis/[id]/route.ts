import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devis")
    .select("*, devis_items(*), projects(id, name)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { items, ...devisData } = body;

  const { data: devis, error } = await supabase
    .from("devis")
    .update({ ...devisData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Replace all items if provided
  if (items !== undefined) {
    await supabase.from("devis_items").delete().eq("devis_id", id);
    if (items.length > 0) {
      const itemsWithId = items.map((item: Record<string, unknown>, idx: number) => ({
        ...item,
        devis_id: id,
        position: idx,
      }));
      await supabase.from("devis_items").insert(itemsWithId);
    }
  }

  return NextResponse.json({ data: devis });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("devis").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
