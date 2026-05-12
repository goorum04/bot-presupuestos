import Link from "next/link";
import {
  Building2, FileText, Wallet, Plus, AlertTriangle,
  TrendingUp, CheckCircle2, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetChart } from "@/components/dashboard/BudgetChart";
import { ExpenseTimeline } from "@/components/dashboard/ExpenseTimeline";
import { formatEUR, formatDate } from "@/lib/utils";
import type { Alert } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function progressColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80)  return "bg-orange-400";
  if (pct >= 60)  return "bg-amber-400";
  return "bg-emerald-500";
}
function progressTextColor(pct: number) {
  if (pct >= 100) return "text-red-600";
  if (pct >= 80)  return "text-orange-500";
  if (pct >= 60)  return "text-amber-600";
  return "text-emerald-600";
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles").select("role, full_name").eq("id", user!.id).single();

  const isAdmin = profile?.role === "admin";
  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "utilisateur";

  const [
    { data: projects },
    { data: invoices },
    { data: alerts },
    { data: categories },
    { data: pendingInvoices },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, total_budget, status, client_name").eq("status", "active"),
    supabase.from("invoices").select("amount_ht, is_validated, created_at, invoice_date, category_id, project_id"),
    supabase.from("alerts").select("*, projects(name)").eq("is_read", false).order("created_at", { ascending: false }).limit(5),
    supabase.from("budget_categories").select("id, project_id, name, slug, budget_amount, alert_threshold_pct"),
    supabase.from("invoices")
      .select("id, supplier_name, amount_ht, created_at, project_id, projects(name)")
      .eq("is_validated", false)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // ── KPIs ──
  const totalBudget = (projects ?? []).reduce((s, p) => s + (p.total_budget ?? 0), 0);
  const totalSpent  = (invoices ?? []).filter((i) => i.is_validated).reduce((s, i) => s + (i.amount_ht ?? 0), 0);
  const pendingCount = (invoices ?? []).filter((i) => !i.is_validated).length;
  const unreadAlerts = alerts?.length ?? 0;

  // ── Project progress cards ──
  const projectCards = (projects ?? []).map((p) => {
    const cats = (categories ?? []).filter((c) => c.project_id === p.id);
    const budget = cats.reduce((s, c) => s + c.budget_amount, 0) || p.total_budget || 0;
    const spent  = (invoices ?? [])
      .filter((i) => i.is_validated && i.project_id === p.id)
      .reduce((s, i) => s + (i.amount_ht ?? 0), 0);
    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const alertCount = (alerts ?? []).filter((a) => (a as Alert & { project_id: string }).project_id === p.id).length;
    return { ...p, budget, spent, pct, alertCount };
  }).sort((a, b) => b.pct - a.pct); // highest consumption first

  // ── Budget chart (aggregate by slug) ──
  const slugMap: Record<string, { budget_amount: number; actual_ht: number; name: string; slug: string }> = {};
  (categories ?? []).forEach((cat) => {
    const catSpent = (invoices ?? [])
      .filter((i) => i.is_validated && i.category_id === cat.id)
      .reduce((s, i) => s + (i.amount_ht ?? 0), 0);
    if (!slugMap[cat.slug]) slugMap[cat.slug] = { budget_amount: 0, actual_ht: 0, name: cat.name, slug: cat.slug };
    slugMap[cat.slug].budget_amount += cat.budget_amount;
    slugMap[cat.slug].actual_ht += catSpent;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = Object.values(slugMap).map((s) => ({ ...s, category_id: s.slug, project_id: "", category_name: s.name, category_slug: s.slug, alert_threshold_pct: 80, pending_ht: 0, invoice_count: 0, pct_used: s.budget_amount > 0 ? (s.actual_ht / s.budget_amount) * 100 : 0 })) as any[];

  // ── Monthly timeline ──
  const monthlyMap: Record<string, number> = {};
  (invoices ?? []).forEach((inv) => {
    const d = inv.invoice_date ?? inv.created_at;
    if (!d) return;
    const m = d.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] ?? 0) + (inv.amount_ht ?? 0);
  });
  const monthlyData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, total_ht]) => ({ month, total_ht }));

  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Bonjour, <span className="font-medium text-gray-700">{displayName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/invoices/upload" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
            <Plus className="size-4" /> <span className="hidden sm:inline">Ajouter facture</span><span className="sm:hidden">Facture</span>
          </Link>
          {isAdmin && (
            <Link href="/projects/new" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600 transition-colors">
              <Plus className="size-4" /> <span className="hidden sm:inline">Nouveau chantier</span><span className="sm:hidden">Chantier</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Budget total", value: formatEUR(totalBudget), icon: <Wallet className="size-5 text-amber-600" />, bg: "bg-amber-50", sub: `${(projects ?? []).length} chantier${(projects ?? []).length !== 1 ? "s" : ""} actif${(projects ?? []).length !== 1 ? "s" : ""}` },
          { label: "Dépensé", value: formatEUR(totalSpent), icon: <TrendingUp className="size-5 text-blue-600" />, bg: "bg-blue-50", sub: totalBudget > 0 ? `${budgetPct.toFixed(1)}% du budget` : "—" },
          { label: "À valider", value: String(pendingCount), icon: <Clock className="size-5 text-orange-600" />, bg: "bg-orange-50", sub: "Factures en attente", highlight: pendingCount > 0 },
          { label: "Alertes", value: String(unreadAlerts), icon: <AlertTriangle className="size-5 text-red-600" />, bg: "bg-red-50", sub: unreadAlerts > 0 ? "Non lues" : "Aucune alerte", highlight: unreadAlerts > 0 },
        ].map(({ label, value, icon, bg, sub, highlight }) => (
          <div key={label} className={`rounded-2xl border p-4 lg:p-5 shadow-sm ${highlight ? "border-red-200 bg-red-50" : "bg-white border-gray-200"}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${bg}`}>{icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Project progress cards */}
      {projectCards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Chantiers actifs</h2>
            <Link href="/projects" className="text-xs font-medium text-amber-600 hover:text-amber-700">Voir tout →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectCards.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-600 transition-colors">{p.name}</p>
                    {p.client_name && <p className="text-xs text-gray-400 truncate mt-0.5">{p.client_name}</p>}
                  </div>
                  {p.alertCount > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold shrink-0">
                      <AlertTriangle className="size-2.5" /> {p.alertCount}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Budget consommé</span>
                    <span className={`font-semibold ${progressTextColor(p.pct)}`}>{p.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progressColor(p.pct)}`}
                      style={{ width: `${Math.min(p.pct, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>{formatEUR(p.spent)} dépensé</span>
                  <span>/ {formatEUR(p.budget)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pending invoices — admin only */}
      {isAdmin && (pendingInvoices ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Factures à valider</h2>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                {pendingCount}
              </span>
            </div>
            <Link href="/invoices" className="text-xs font-medium text-amber-600 hover:text-amber-700">Voir tout →</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {(pendingInvoices ?? []).map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 shrink-0">
                  <FileText className="size-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {inv.supplier_name ?? "Fournisseur inconnu"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {/* @ts-ignore */}
                    {inv.projects?.name ?? "—"} · {formatDate(inv.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatEUR(inv.amount_ht ?? 0)}</p>
                  <p className="text-[10px] text-orange-500 font-medium">À valider</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* No projects CTA */}
      {(projects ?? []).length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-4">
            <Building2 className="size-8 text-amber-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Aucun chantier actif</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-4">Créez votre premier chantier pour commencer à suivre les budgets et factures.</p>
          {isAdmin && (
            <Link href="/projects/new" className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors">
              <Plus className="size-4" /> Créer un chantier
            </Link>
          )}
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Budget par catégorie</CardTitle></CardHeader>
            <CardContent><BudgetChart data={chartData} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Évolution des dépenses (6 mois)</CardTitle></CardHeader>
            <CardContent>
              {monthlyData.length > 0
                ? <ExpenseTimeline data={monthlyData} />
                : <EmptyChart message="Ajoutez des factures pour voir l'évolution" />}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {isAdmin && (alerts ?? []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Alertes récentes</h2>
            <Link href="/alerts" className="text-xs font-medium text-amber-600 hover:text-amber-700">Voir tout →</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {(alerts ?? []).map((alert: Alert) => (
              <div key={alert.id} className="flex items-start gap-3 px-4 py-3">
                <AlertTriangle className={`size-4 mt-0.5 shrink-0 ${alert.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                  <p className="text-xs text-gray-400 truncate">{alert.message}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${alert.severity === "critical" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                  {alert.severity === "critical" ? "Critique" : "Avertissement"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="h-[200px] flex items-center justify-center text-sm text-gray-400 text-center">{message}</div>;
}
