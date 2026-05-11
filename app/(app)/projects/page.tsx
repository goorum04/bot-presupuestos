import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/projects/ProjectCard";
import type { Project } from "@/types";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*, budget_categories(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch projects:", error.message);
  }

  const list: Project[] = projects ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chantiers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {list.length > 0
              ? `${list.length} chantier${list.length > 1 ? "s" : ""} au total`
              : "Aucun chantier pour le moment"}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
        >
          <Plus className="size-4" />
          Nouveau chantier
        </Link>
      </div>

      {/* Content */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-gray-200 bg-white">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-50 mb-4">
            <Building2 className="size-8 text-gray-300" />
          </div>
          <h2 className="text-base font-semibold text-gray-700 mb-1">
            Aucun chantier créé
          </h2>
          <p className="text-sm text-gray-400 mb-6 max-w-xs">
            Commencez par créer votre premier chantier pour suivre vos budgets
            et vos factures.
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
          >
            <Plus className="size-4" />
            Créer un chantier
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {list.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
