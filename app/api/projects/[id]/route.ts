import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/types";

// ─── GET /api/projects/[id] ──────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: project, error } = await supabase
      .from("projects")
      .select("*, budget_categories(*)")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Chantier introuvable." }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch recent invoice count for this project
    const { count: invoiceCount, error: countError } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    return NextResponse.json({ ...project, invoice_count: invoiceCount ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── PATCH /api/projects/[id] ────────────────────────────────────────────────

interface PatchProjectBody {
  name?: string;
  client_name?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_budget?: number;
  status?: ProjectStatus;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body: PatchProjectBody = await request.json();

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          { error: "Le nom du chantier ne peut pas être vide." },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.client_name !== undefined) {
      updates.client_name = body.client_name?.trim() || null;
    }

    if (body.address !== undefined) {
      updates.address = body.address?.trim() || null;
    }

    if (body.start_date !== undefined) {
      updates.start_date = body.start_date || null;
    }

    if (body.end_date !== undefined) {
      updates.end_date = body.end_date || null;
    }

    if (body.total_budget !== undefined) {
      if (typeof body.total_budget !== "number" || body.total_budget <= 0) {
        return NextResponse.json(
          { error: "Le budget total doit être un nombre positif." },
          { status: 400 }
        );
      }
      updates.total_budget = body.total_budget;
    }

    const validStatuses: ProjectStatus[] = ["active", "paused", "completed", "archived"];
    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Statut invalide. Valeurs autorisées : ${validStatuses.join(", ")}.` },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: updated, error: updateError } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        return NextResponse.json({ error: "Chantier introuvable." }, { status: 404 });
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE /api/projects/[id] ───────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Check admin role via profiles table
    const { data: profile, error: profileError } = await authClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable." }, { status: 403 });
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seul un administrateur peut supprimer un chantier." },
        { status: 403 }
      );
    }

    const supabase = await createServiceClient();

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
