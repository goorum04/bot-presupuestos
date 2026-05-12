"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { PriceComparisonTable } from "@/components/catalogue/PriceComparisonTable";
import type { SuggestedProduct } from "@/types";

export default function ComparePage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<SuggestedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/catalogue/suggest?q=${encodeURIComponent(q)}&limit=20`);
      const json = await res.json();
      setResults(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query.trim().length >= 2) doSearch(query);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query);
  }

  const rows = results.map((r) => ({
    supplier_name: r.supplier_name,
    product_name: r.product_name,
    reference: r.reference,
    unit: r.unit,
    unit_price_ht: r.unit_price_ht,
    price_updated_at: r.price_updated_at,
    source: "catalogue",
  }));

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalogue" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comparer les prix</h1>
          <p className="text-sm text-gray-500">Comparez le même produit chez différents fournisseurs</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-300 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Ex: ciment portland 25kg, laine de roche…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors"
        >
          Rechercher
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : (
          <PriceComparisonTable rows={rows} />
        )}
      </div>
    </div>
  );
}
