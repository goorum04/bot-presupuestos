import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { CategorySlug } from "@/types";

// ─── GET /api/projects ───────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("projects")
      .select("*, budget_categories(*)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST /api/projects ──────────────────────────────────────────────────────

interface CategoryInput {
  slug: CategorySlug;
  name: string;
  budget_amount: number;
}

interface CreateProjectBody {
  name: string;
  client_name?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_budget: number;
  categories?: CategoryInput[];
}

export async function POST(request: NextRequest) {
  try {
    // Use the authed client to resolve the current user
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body: CreateProjectBody = await request.json();

    const { name, client_name, address, start_date, end_date, total_budget, categories } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Le nom du chantier est obligatoire." },
        { status: 400 }
      );
    }

    if (typeof total_budget !== "number" || total_budget <= 0) {
      return NextResponse.json(
        { error: "Le budget total doit être un nombre positif." },
        { status: 400 }
      );
    }

    // Use service client for the writes (bypasses RLS during insert)
    const supabase = await createServiceClient();

    // Insert project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        client_name: client_name?.trim() || null,
        address: address?.trim() || null,
        start_date: start_date || null,
        end_date: end_date || null,
        total_budget,
        created_by: user.id,
        status: "active",
      })
      .select("id")
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: projectError?.message ?? "Erreur lors de la création du chantier." },
        { status: 500 }
      );
    }

    const projectId = project.id as string;

    // Insert budget categories if provided
    if (categories && categories.length > 0) {
      const categoryRows = categories.map((cat) => ({
        project_id: projectId,
        slug: cat.slug,
        name: cat.name,
        budget_amount: typeof cat.budget_amount === "number" ? cat.budget_amount : 0,
        alert_threshold_pct: 80,
      }));

      const { error: catError } = await supabase
        .from("budget_categories")
        .insert(categoryRows);

      if (catError) {
        // Project was created; attempt to clean it up
        await supabase.from("projects").delete().eq("id", projectId);
        return NextResponse.json(
          { error: catError.message ?? "Erreur lors de la création des catégories." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ id: projectId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
