"use client";

import { Download } from "lucide-react";

interface RateSummary { ht: number; tva: number; ttc: number; count: number }
interface MonthData { month: string; label: string; rates: Record<string, RateSummary>; totals: RateSummary }

export function TvaExportButton({ months }: { months: MonthData[] }) {
  function handleExport() {
    const rows = [
      ["Mois", "Taux TVA", "Base HT (€)", "TVA (€)", "TTC (€)", "Nb factures"],
    ];
    for (const m of months) {
      for (const [rate, data] of Object.entries(m.rates)) {
        rows.push([
          m.label,
          `${rate}%`,
          data.ht.toFixed(2),
          data.tva.toFixed(2),
          data.ttc.toFixed(2),
          String(data.count),
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recap-tva-${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
    >
      <Download className="size-4" />
      Export CSV
    </button>
  );
}
