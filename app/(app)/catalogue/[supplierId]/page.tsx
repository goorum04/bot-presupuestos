"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Upload, RefreshCw, Download } from "lucide-react";
import { ProductsTable } from "@/components/catalogue/ProductsTable";
import type { CatalogProduct } from "@/types";

export default function SupplierProductsPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = use(params);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [supplierName, setSupplierName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = useCallback(async () => {
    const [prodRes, supRes] = await Promise.all([
      fetch(`/api/catalogue/products?supplier_id=${supplierId}&page_size=500`),
      fetch(`/api/catalogue/suppliers`),
    ]);
    const prodJson = await prodRes.json();
    const supJson = await supRes.json();
    setProducts(prodJson.data ?? []);
    const sup = (supJson.data ?? []).find((s: { id: string; name: string }) => s.id === supplierId);
    if (sup) setSupplierName(sup.name);
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce produit ?")) return;
    await fetch(`/api/catalogue/products/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetch(`/api/catalogue/scrape/${supplierId}`, { method: "POST" });
    await fetchProducts();
    setRefreshing(false);
  }

  function handleExportCsv() {
    const header = "reference,name,description,unit,unit_price_ht,category_slug\n";
    const rows = products.map((p) =>
      [
        p.reference ?? "",
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.description ?? "").replace(/"/g, '""')}"`,
        p.unit,
        p.unit_price_ht ?? "",
        p.material_categories?.slug ?? "",
      ].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalogue_${supplierName.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalogue" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {supplierName || "Fournisseur"}
          </h1>
          <p className="text-sm text-gray-500">{products.length} produit(s) dans le catalogue</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            Rafraîchir
          </button>
          <Link
            href={`/catalogue/${supplierId}/import`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Upload className="size-4" />
            Import CSV
          </Link>
          <button
            onClick={handleExportCsv}
            disabled={products.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            <Download className="size-4" />
            Exporter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Filtrer par désignation ou référence…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : (
          <ProductsTable products={filtered} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
