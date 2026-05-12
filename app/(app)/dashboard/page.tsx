import Link from "next/link";
import {
  Building2,
  FileText,
  Wallet,
  Plus,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BudgetChart } from "@/components/dashboard/BudgetChart";
import { ExpenseTimeline } from "@/components/dashboard/ExpenseTimeline";
import { formatEUR, formatDate } from "@/lib/utils";
import type { Alert } from "@/types";

// ─── KPI card component ────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  accent?: string;
  highlight?: boolean;
}

function KpiCard({
  label,
  value,
  icon,
  description,
  accent = "bg-gray-100",
  highlight,
}: KpiCardProps) {
  return (
    <div className={`bg-white rounded-2xl border p-6 shadow-sm flex flex-col gap-4 ${highlight ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${accent}`}
        >
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">
          {value}
        </p>
        {description && (
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName = user?.email?.split("@")[0] ?? "utilisateur";

  const [
    { data: projects },
    { data: invoices },
    { data: alerts },
    { data: categories },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("status", "active"),
    supabase.from("invoices").select("amount_ht, is_validated, created_at, invoice_date, category_id").limit(300),
    supabase.from("alerts").select("*, projects(name)").eq("is_read", false).order("created_at", { ascending: false }).limit(5),
    supabase.from("budget_categories").select("*"),
  ]);

  const totalBudget = (projects ?? []).reduce((s: number, p: { total_budget: number }) => s + (p.total_budget ?? 0), 0);
  const totalSpent = (invoices ?? []).filter((i: { is_validated: boolean }) => i.is_validated).reduce((s: number, i: { amount_ht: number | null }) => s + (i.amount_ht ?? 0), 0);
  const pendingCount = (invoices ?? []).filter((i: { is_validated: boolean }) => !i.is_validated).length;
  const unreadAlerts = alerts?.length ?? 0;

  // Budget chart data per category
  const budgetSummary = (categories ?? []).map((cat: { id: string; project_id: string; name: string; slug: string; budget_amount: number; alert_threshold_pct: number }) => {
    const catSpent = (invoices ?? [])
      .filter((i: { is_validated: boolean; category_id: string | null }) => i.is_validated && i.category_id === cat.id)
      .reduce((s: number, i: { amount_ht: number | null }) => s + (i.amount_ht ?? 0), 0);
    return {
      category_id: cat.id, project_id: cat.project_id, category_name: cat.name,
      category_slug: cat.slug, budget_amount: cat.budget_amount,
      alert_threshold_pct: cat.alert_threshold_pct, actual_ht: catSpent,
      pending_ht: 0, invoice_count: 0,
      pct_used: cat.budget_amount > 0 ? (catSpent / cat.budget_amount) * 100 : 0,
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any[];

  // Aggregate by category slug for chart
  const slugMap: Record<string, { budget_amount: number; actual_ht: number; name: string; slug: string; pct_used: number }> = {};
  budgetSummary.forEach((s: { category_slug: string; category_name: string; budget_amount: number; actual_ht: number; pct_used: number }) => {
    if (!slugMap[s.category_slug]) slugMap[s.category_slug] = { budget_amount: 0, actual_ht: 0, name: s.category_name, slug: s.category_slug, pct_used: 0 };
    slugMap[s.category_slug].budget_amount += s.budget_amount;
    slugMap[s.category_slug].actual_ht += s.actual_ht;
  });
  const chartData = Object.values(slugMap).map((s) => ({
    ...s, category_id: s.slug, project_id: "", category_name: s.name,
    category_slug: s.slug, alert_threshold_pct: 80, pending_ht: 0, invoice_count: 0,
    pct_used: s.budget_amount > 0 ? (s.actual_ht / s.budget_amount) * 100 : 0,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any[];

  // Monthly timeline (last 6 months)
  const monthlyMap: Record<string, number> = {};
  (invoices ?? []).forEach((inv: { invoice_date: string | null; created_at: string; amount_ht: number | null }) => {
    const d = inv.invoice_date ?? inv.created_at;
    if (!d) return;
    const m = d.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] ?? 0) + (inv.amount_ht ?? 0);
  });
  const monthlyData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, total_ht]) => ({ month, total_ht }));

  const kpis = [
    { label: "Budget total", value: formatEUR(totalBudget), icon: <Wallet className="size-5 text-amber-600" />, accent: "bg-amber-50", description: `${(projects ?? []).length} chantier${(projects ?? []).length !== 1 ? "s" : ""} actif${(projects ?? []).length !== 1 ? "s" : ""}` },
    { label: "Dépensé (validé)", value: formatEUR(totalSpent), icon: <TrendingUp className="size-5 text-blue-600" />, accent: "bg-blue-50", description: totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}% du budget` : "—" },
    { label: "Factures en attente", value: String(pendingCount), icon: <FileText className="size-5 text-orange-600" />, accent: "bg-orange-50", description: "À valider" },
    { label: "Alertes actives", value: String(unreadAlerts), icon: <AlertTriangle className="size-5 text-red-600" />, accent: "bg-red-50", description: unreadAlerts > 0 ? "Non lues" : "Aucune alerte", highlight: unreadAlerts > 0 },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Bonjour, <span className="font-medium text-gray-700">{displayName}</span>. Vue d&apos;ensemble des chantiers actifs.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/invoices/upload" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs md:text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
            <Plus className="size-3.5 md:size-4" /> <span className="hidden sm:inline">Facture</span><span className="sm:hidden">+Fact.</span>
          </Link>
          <Link href="/projects/new" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs md:text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600">
            <Plus className="size-3.5 md:size-4" /> <span className="hidden sm:inline">Chantier</span><span className="sm:hidden">+Chant.</span>
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Budget par catégorie</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? <BudgetChart data={chartData} /> : <EmptyChart message="Créez un chantier avec des catégories de budget" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Évolution des dépenses (6 mois)</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? <ExpenseTimeline data={monthlyData} /> : <EmptyChart message="Ajoutez des factures pour voir l'évolution" />}
          </CardContent>
        </Card>
      </div>

      {/* Projects + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Chantiers actifs</h2>
            <Link href="/projects" className="text-xs font-medium text-amber-600 hover:text-amber-700">Voir tout →</Link>
          </div>
          {(projects ?? []).length > 0 ? (
            <div className="space-y-2">
              {(projects ?? []).slice(0, 5).map((p: { id: string; name: string; total_budget: number }) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="p-1.5 rounded-md bg-blue-100"><Building2 size={14} className="text-blue-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">Budget: {formatEUR(p.total_budget)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Building2 className="size-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Aucun chantier pour le moment.</p>
              <Link href="/projects/new" className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                <Plus className="size-3.5" /> Créer un chantier
              </Link>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Alertes récentes</h2>
            <Link href="/alerts" className="text-xs font-medium text-amber-600 hover:text-amber-700">Voir tout →</Link>
          </div>
          {(alerts ?? []).length > 0 ? (
            <div className="space-y-2">
              {(alerts ?? []).map((alert: Alert) => (
                <div key={alert.id} className="flex gap-3 p-2 rounded-lg bg-gray-50">
                  <AlertTriangle size={16} className={alert.severity === "critical" ? "text-red-500 shrink-0 mt-0.5" : "text-amber-500 shrink-0 mt-0.5"} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    <p className="text-xs text-gray-400 truncate">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(alert.created_at)}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 self-start text-xs ${alert.severity === "critical" ? "border-red-200 text-red-600" : "border-amber-200 text-amber-600"}`}>
                    {alert.severity === "critical" ? "Critique" : "Avertissement"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertTriangle className="size-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Aucune alerte active</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center">{message}</div>;
}
