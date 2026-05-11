import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { evaluateAlerts } from "@/lib/services/alert.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `*, projects(id, name), budget_categories(id, name, slug), profiles!uploaded_by(id, full_name)`
    )
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Build signed URL for image display
  const { data: signed } = await supabase.storage
    .from("invoices")
    .createSignedUrl(data.image_path, 3600);

  return NextResponse.json({ invoice: data, image_url: signed?.signedUrl });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // If validating, record who did it
  if (body.is_validated === true) {
    body.validated_by = user.id;
    body.validated_at = new Date().toISOString();

    // Re-evaluate alerts after validation
    const { data: inv } = await supabase
      .from("invoices")
      .select("project_id, category_id")
      .eq("id", id)
      .single();

    if (inv) {
      await evaluateAlerts(inv.project_id, inv.category_id, id, supabase);
    }
  }

  body.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("invoices")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServiceClient();

  // Get image path to delete from storage
  const { data: inv } = await supabase
    .from("invoices")
    .select("image_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("invoices").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clean up storage
  if (inv?.image_path) {
    await supabase.storage.from("invoices").remove([inv.image_path]);
  }

  return NextResponse.json({ success: true });
}
