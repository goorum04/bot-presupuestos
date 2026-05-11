import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const projectId = searchParams.get("project_id");
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  let query = supabase
    .from("alerts")
    .select(`*, projects(id, name)`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) query = query.eq("project_id", projectId);
  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { ids, mark_all_read } = body as {
    ids?: string[];
    mark_all_read?: boolean;
  };

  if (mark_all_read) {
    const { error } = await supabase
      .from("alerts")
      .update({ is_read: true, read_by: user.id, read_at: new Date().toISOString() })
      .eq("is_read", false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (ids?.length) {
    const { error } = await supabase
      .from("alerts")
      .update({ is_read: true, read_by: user.id, read_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
