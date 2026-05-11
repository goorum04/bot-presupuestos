import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  MapPin,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type Project,
  type BudgetCategory,
  type Invoice,
  type ProjectStatus,
} from "@/types";
import { formatEUR, formatDate, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ─── Status badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-green-50 text-green-700 ring-1 ring-green-200" },
  paused: { label: "En pause", className: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200" },
  completed: { label: "Terminé", className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  archived: { label: "Archivé", className: "bg-gray-100 text-gray-500 ring-1 ring-gray-200" },
};

// ─── Budget category card ────────────────────────────────────────────────────

interface BudgetCategoryCardProps {
  category: BudgetCategory;
  spent: number;
}

function BudgetCategoryCard({ category, spent }: BudgetCategoryCardProps) {
  const color = CATEGORY_COLORS[category.slug] ?? "#6b7280";
  const pct = category.budget_amount > 0 ? Math.min((spent / category.budget_amount) * 100, 100) : 0;
  const isOver = spent > category.budget_amount;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-gray-800">
            {CATEGORY_LABELS[category.slug]}
          </span>
        </div>
        {isOver && (
          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            Dépassé
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: isOver ? "#ef4444" : color,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Dépensé : <span className="font-semibold text-gray-700">{formatEUR(spent)}</span>
        </span>
        <span>
          Budget : <span className="font-semibold text-gray-700">{formatEUR(category.budget_amount)}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Invoice status icon ─────────────────────────────────────────────────────

function InvoiceStatusIcon({ status }: { status: Invoice["ocr_status"] }) {
  if (status === "completed") return <CheckCircle2 className="size-4 text-green-500" />;
  if (status === "failed") return <XCircle className="size-4 text-red-400" />;
  return <Clock className="size-4 text-amber-400" />;
}

// ─── Invoice row ────────────────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <Link
      href={`/invoices/${invoice.id}`}
      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 transition-colors rounded-xl group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <InvoiceStatusIcon status={invoice.ocr_status} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {invoice.supplier_name ?? "Fournisseur inconnu"}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {invoice.invoice_number ? `N° ${invoice.invoice_number}` : "Numéro inconnu"}
            {invoice.invoice_date ? ` · ${formatDate(invoice.invoice_date, { dateStyle: "short" })}` : ""}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-900">
          {formatEUR(invoice.amount_ttc)}
        </p>
        <p className="text-xs text-gray-400">
          {invoice.payment_status === "paid"
            ? "Payée"
            : invoice.payment_status === "partial"
              ? "Partiel"
              : "Non payée"}
        </p>
      </div>
    </Link>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch project + budget categories
  const { data: project, error } = await supabase
    .from("projects")
    .select("*, budget_categories(*)")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  const typedProject = project as Project;
  const categories: BudgetCategory[] = typedProject.budget_categories ?? [];

  // Fetch recent invoices for this project
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const invoices: Invoice[] = invoicesData ?? [];

  const statusCfg = STATUS_CONFIG[typedProject.status];

  // Compute total category budgets allocated
  const allocatedTotal = categories.reduce((sum, c) => sum + c.budget_amount, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Retour aux chantiers
      </Link>

      {/* Project header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {typedProject.name}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  statusCfg.className
                )}
              >
                {statusCfg.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {typedProject.client_name && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <User className="size-3.5 text-gray-400 shrink-0" />
                  {typedProject.client_name}
                </div>
              )}
              {typedProject.address && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin className="size-3.5 text-gray-400 shrink-0" />
                  {typedProject.address}
                </div>
              )}
              {(typedProject.start_date || typedProject.end_date) && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Calendar className="size-3.5 text-gray-400 shrink-0" />
                  <span>
                    {typedProject.start_date
                      ? formatDate(typedProject.start_date, { dateStyle: "medium" })
                      : "—"}
                    {" → "}
                    {typedProject.end_date
                      ? formatDate(typedProject.end_date, { dateStyle: "medium" })
                      : "—"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Budget summary */}
          <div className="shrink-0 text-right space-y-0.5">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
              Budget total
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {formatEUR(typedProject.total_budget)}
            </p>
            <p className="text-xs text-gray-400">
              {formatEUR(allocatedTotal)} répartis
            </p>
          </div>
        </div>
      </div>

      {/* Budget categories */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Budget par catégorie
          </h2>
          <span className="text-xs text-gray-400">
            {categories.length} catégorie{categories.length !== 1 ? "s" : ""}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-400">
              Aucune catégorie de budget définie pour ce chantier.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <BudgetCategoryCard key={cat.id} category={cat} spent={0} />
            ))}
          </div>
        )}
      </div>

      {/* Recent invoices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Factures récentes
          </h2>
          <Link
            href={`/invoices/upload?project_id=${id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
          >
            <Plus className="size-3.5" />
            Ajouter une facture
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-50 mb-3">
                <FileText className="size-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Aucune facture pour ce chantier
              </p>
              <p className="text-xs text-gray-400 mb-5">
                Ajoutez votre première facture pour commencer le suivi.
              </p>
              <Link
                href={`/invoices/upload?project_id=${id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Plus className="size-3.5" />
                Ajouter une facture
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 p-2">
              {invoices.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
