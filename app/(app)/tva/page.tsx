import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/utils";
import { TvaExportButton } from "@/components/tva/TvaExportButton";

const RATE_LABELS: Record<string, { label: string; color: string; rule: string }> = {
  "20": { label: "20% — Travaux neufs", color: "bg-blue-100 text-blue-800", rule: "Taux normal" },
  "10": { label: "10% — Rénovation", color: "bg-green-100 text-green-800", rule: "Taux intermédiaire" },
  "5.5": { label: "5.5% — Réno. énergétique", color: "bg-amber-100 text-amber-800", rule: "Taux réduit" },
  "2.1": { label: "2.1%", color: "bg-purple-100 text-purple-800", rule: "Taux super réduit" },
  "0": { label: "0% — Exonéré", color: "bg-gray-100 text-gray-700", rule: "Exonération" },
};

export default async function TvaPage() {
  const supabase = await createClient();

  // All validated invoices with TVA data
  const { data: invoices } = await supabase
    .from("invoices")
    .select("invoice_date, amount_ht, tva_rate, tva_amount, amount_ttc, tva_breakdown, is_validated")
    .eq("is_validated", true)
    .not("tva_rate", "is", null)
    .order("invoice_date", { ascending: false });

  // Group by month and tva_rate
  type RateSummary = { ht: number; tva: number; ttc: number; count: number };
  type MonthData = { month: string; label: string; rates: Record<string, RateSummary>; totals: RateSummary };

  const monthMap: Record<string, MonthData> = {};

  for (const inv of invoices ?? []) {
    const month = (inv.invoice_date ?? "").slice(0, 7);
    if (!month) continue;
    if (!monthMap[month]) {
      const [y, m] = month.split("-");
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      monthMap[month] = { month, label, rates: {}, totals: { ht: 0, tva: 0, ttc: 0, count: 0 } };
    }

    // Handle tva_breakdown for multi-rate invoices
    const items = inv.tva_breakdown && Array.isArray(inv.tva_breakdown) && inv.tva_breakdown.length > 0
      ? inv.tva_breakdown.map((b: { rate: number; base_ht: number; tva: number }) => ({ rate: String(b.rate), ht: b.base_ht, tva: b.tva }))
      : [{ rate: String(inv.tva_rate ?? "20"), ht: inv.amount_ht ?? 0, tva: inv.tva_amount ?? 0 }];

    for (const item of items) {
      const rateKey = item.rate;
      if (!monthMap[month].rates[rateKey]) {
        monthMap[month].rates[rateKey] = { ht: 0, tva: 0, ttc: 0, count: 0 };
      }
      monthMap[month].rates[rateKey].ht += item.ht;
      monthMap[month].rates[rateKey].tva += item.tva;
      monthMap[month].rates[rateKey].ttc += item.ht + item.tva;
      monthMap[month].rates[rateKey].count += 1;
      monthMap[month].totals.ht += item.ht;
      monthMap[month].totals.tva += item.tva;
      monthMap[month].totals.ttc += item.ht + item.tva;
    }
    monthMap[month].totals.count += 1;
  }

  const months = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));

  // Grand totals per rate (all time)
  const globalRates: Record<string, RateSummary> = {};
  for (const m of months) {
    for (const [rate, data] of Object.entries(m.rates)) {
      if (!globalRates[rate]) globalRates[rate] = { ht: 0, tva: 0, ttc: 0, count: 0 };
      globalRates[rate].ht += data.ht;
      globalRates[rate].tva += data.tva;
      globalRates[rate].ttc += data.ttc;
      globalRates[rate].count += data.count;
    }
  }
  const globalTotals = Object.values(globalRates).reduce(
    (acc, r) => ({ ht: acc.ht + r.ht, tva: acc.tva + r.tva, ttc: acc.ttc + r.ttc, count: acc.count + r.count }),
    { ht: 0, tva: 0, ttc: 0, count: 0 }
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Récapitulatif TVA</h1>
          <p className="text-sm text-gray-500 mt-1">
            Résumé pour votre comptable · Factures validées uniquement
          </p>
        </div>
        <TvaExportButton months={months} />
      </div>

      {/* Totals global */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-amber-800 uppercase tracking-wide">
            Total toutes périodes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">Total HT</p>
              <p className="text-lg font-bold text-gray-900">{formatEUR(globalTotals.ht)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total TVA</p>
              <p className="text-lg font-bold text-amber-700">{formatEUR(globalTotals.tva)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total TTC</p>
              <p className="text-lg font-bold text-gray-900">{formatEUR(globalTotals.ttc)}</p>
            </div>
          </div>

          {/* Breakdown by rate */}
          <div className="mt-4 space-y-2">
            {Object.entries(globalRates).sort(([a], [b]) => Number(b) - Number(a)).map(([rate, data]) => {
              const info = RATE_LABELS[rate] ?? { label: `${rate}%`, color: "bg-gray-100 text-gray-700", rule: "" };
              return (
                <div key={rate} className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                    <span className="text-xs text-gray-400">{info.rule}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-right">
                    <span className="text-gray-600">{formatEUR(data.ht)} HT</span>
                    <span className="font-semibold text-amber-700">{formatEUR(data.tva)} TVA</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Monthly breakdown */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700">Détail par mois</h2>
        {months.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">Aucune facture validée pour l&apos;instant.</p>
        )}
        {months.map((m) => (
          <Card key={m.month}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold capitalize">{m.label}</CardTitle>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{m.totals.count} facture{m.totals.count > 1 ? "s" : ""}</span>
                  <span className="font-semibold text-gray-900">{formatEUR(m.totals.ht)} HT</span>
                  <span className="font-semibold text-amber-700">+ {formatEUR(m.totals.tva)} TVA</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {Object.entries(m.rates).sort(([a], [b]) => Number(b) - Number(a)).map(([rate, data]) => {
                  const info = RATE_LABELS[rate] ?? { label: `${rate}%`, color: "bg-gray-100 text-gray-700", rule: "" };
                  return (
                    <div key={rate} className="flex items-center justify-between text-sm">
                      <Badge variant="outline" className={`text-xs ${info.color} border-0`}>{info.label}</Badge>
                      <div className="flex gap-4 text-right">
                        <span className="text-gray-500">{formatEUR(data.ht)} HT</span>
                        <span className="font-medium text-amber-700 w-24">{formatEUR(data.tva)} TVA</span>
                        <span className="text-gray-700 w-28">{formatEUR(data.ttc)} TTC</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Legal note */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">ℹ️ Information légale</p>
        <p>Les taux applicables aux travaux BTP en France : <strong>20%</strong> travaux neufs · <strong>10%</strong> rénovation · <strong>5.5%</strong> rénovation énergétique (article 279-0 bis CGI).</p>
        <p>Ce récapitulatif est fourni à titre indicatif. Votre comptable ou expert-comptable doit valider votre déclaration de TVA.</p>
      </div>
    </div>
  );
}
