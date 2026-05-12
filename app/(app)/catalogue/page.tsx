"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Package2 } from "lucide-react";
import { SupplierCatalogCard } from "@/components/catalogue/SupplierCatalogCard";

interface SupplierWithJob {
  id: string;
  name: string;
  city: string | null;
  website: string | null;
  catalog_url: string | null;
  scrape_enabled: boolean;
  last_scraped_at: string | null;
  product_count: number;
  last_job: {
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    completed_at: string | null;
    error_message: string | null;
  } | null;
}

export default function CataloguePage() {
  const [suppliers, setSuppliers] = useState<SupplierWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchSuppliers = useCallback(async () => {
    const res = await fetch("/api/catalogue/suppliers");
    const json = await res.json();
    setSuppliers(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  async function handleRefresh(supplierId: string) {
    const res = await fetch(`/api/catalogue/scrape/${supplierId}`, { method: "POST" });
    if (res.ok) await fetchSuppliers();
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100">
          <Package2 className="size-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catalogue fournisseurs</h1>
          <p className="text-sm text-gray-500">Gérez les produits et tarifs de vos fournisseurs</p>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <input
          className="w-full rounded-xl border border-gray-300 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          placeholder="Rechercher un fournisseur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package2 className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {search ? "Aucun fournisseur ne correspond à cette recherche." : "Aucun fournisseur configuré."}
          </p>
          <p className="text-xs mt-1">Ajoutez des fournisseurs dans les Réglages.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SupplierCatalogCard
              key={s.id}
              supplier={s}
              onRefresh={s.scrape_enabled ? handleRefresh : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
