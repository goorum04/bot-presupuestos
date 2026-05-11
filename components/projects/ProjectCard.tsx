"use client";

import Link from "next/link";
import { MapPin, User, Calendar, ArrowRight } from "lucide-react";
import { Project, ProjectStatus, CATEGORY_LABELS, CATEGORY_COLORS } from "@/types";
import { formatEUR, formatDate, cn } from "@/lib/utils";

// ─── Status badge ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Actif",
    className:
      "bg-green-50 text-green-700 ring-1 ring-green-200",
  },
  paused: {
    label: "En pause",
    className:
      "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  },
  completed: {
    label: "Terminé",
    className:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  archived: {
    label: "Archivé",
    className:
      "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
  },
};

// ─── Budget bar ────────────────────────────────────────────────────────────

interface BudgetBarProps {
  categories: NonNullable<Project["budget_categories"]>;
  totalBudget: number;
}

function BudgetBar({ categories, totalBudget }: BudgetBarProps) {
  if (!categories.length || totalBudget <= 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        {categories.map((cat) => {
          const pct =
            totalBudget > 0
              ? Math.min((cat.budget_amount / totalBudget) * 100, 100)
              : 0;
          const color =
            CATEGORY_COLORS[cat.slug] ?? "#6b7280";
          return (
            <div
              key={cat.id}
              style={{ width: `${pct}%`, backgroundColor: color }}
              className="h-full"
              title={`${CATEGORY_LABELS[cat.slug]}: ${formatEUR(cat.budget_amount)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── ProjectCard ───────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const statusCfg = STATUS_CONFIG[project.status];
  const categories = project.budget_categories ?? [];

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-200"
    >
      <div className="p-5 space-y-4">
        {/* Top row: name + status */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-gray-900 leading-tight group-hover:text-amber-600 transition-colors">
            {project.name}
          </h3>
          <span
            className={cn(
              "shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
              statusCfg.className
            )}
          >
            {statusCfg.label}
          </span>
        </div>

        {/* Client + address */}
        <div className="space-y-1.5">
          {project.client_name && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <User className="size-3.5 shrink-0 text-gray-400" />
              <span className="truncate">{project.client_name}</span>
            </div>
          )}
          {project.address && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin className="size-3.5 shrink-0 text-gray-400" />
              <span className="truncate">{project.address}</span>
            </div>
          )}
        </div>

        {/* Budget */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Budget total
            </span>
            <span className="text-sm font-bold text-gray-900">
              {formatEUR(project.total_budget)}
            </span>
          </div>
          {categories.length > 0 && (
            <BudgetBar
              categories={categories}
              totalBudget={project.total_budget}
            />
          )}
        </div>

        {/* Dates + arrow */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar className="size-3.5 shrink-0" />
            <span>
              {project.start_date
                ? formatDate(project.start_date, { dateStyle: "short" })
                : "—"}
              {" → "}
              {project.end_date
                ? formatDate(project.end_date, { dateStyle: "short" })
                : "—"}
            </span>
          </div>
          <ArrowRight className="size-4 text-gray-300 group-hover:text-amber-500 transition-colors" />
        </div>
      </div>
    </Link>
  );
}
