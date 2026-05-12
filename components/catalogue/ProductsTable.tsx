"use client";

import { useState } from "react";
import { Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { CatalogProduct } from "@/types";

interface ProductsTableProps {
  products: CatalogProduct[];
  onDelete?: (id: string) => void;
  onEdit?: (product: CatalogProduct) => void;
}

type SortKey = "name" | "unit_price_ht" | "price_updated_at";

const SOURCE_LABELS: Record<CatalogProduct["source"], string> = {
  scrape: "Web",
  csv_import: "CSV",
  manual: "Manuel",
};

const SOURCE_COLORS: Record<CatalogProduct["source"], string> = {
  scrape: "bg-blue-100 text-blue-700",
  csv_import: "bg-purple-100 text-purple-700",
  manual: "bg-gray-100 text-gray-600",
};

export function ProductsTable({ products, onDelete, onEdit }: ProductsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "name", asc: true });

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, asc: !s.asc } : { key, asc: true });
  }

  const sorted = [...products].sort((a, b) => {
    const mul = sort.asc ? 1 : -1;
    if (sort.key === "name") return mul * a.name.localeCompare(b.name, "fr");
    if (sort.key === "unit_price_ht") return mul * ((a.unit_price_ht ?? 0) - (b.unit_price_ht ?? 0));
    if (sort.key === "price_updated_at") {
      return mul * ((a.price_updated_at ?? "").localeCompare(b.price_updated_at ?? ""));
    }
    return 0;
  });

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ChevronUp className="size-3 opacity-20" />;
    return sort.asc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />;
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucun produit. Importez un CSV ou lancez une synchronisation.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <th className="pb-2 text-left font-medium w-24">Réf.</th>
            <th className="pb-2 text-left font-medium cursor-pointer select-none" onClick={() => toggleSort("name")}>
              <span className="inline-flex items-center gap-1">Désignation <SortIcon k="name" /></span>
            </th>
            <th className="pb-2 text-left font-medium w-32">Catégorie</th>
            <th className="pb-2 text-left font-medium w-16">Unité</th>
            <th className="pb-2 text-right font-medium w-28 cursor-pointer select-none" onClick={() => toggleSort("unit_price_ht")}>
              <span className="inline-flex items-center gap-1 justify-end">Prix HT <SortIcon k="unit_price_ht" /></span>
            </th>
            <th className="pb-2 text-center font-medium w-20">Source</th>
            <th className="pb-2 text-right font-medium w-28 cursor-pointer select-none" onClick={() => toggleSort("price_updated_at")}>
              <span className="inline-flex items-center gap-1 justify-end">Mise à jour <SortIcon k="price_updated_at" /></span>
            </th>
            {(onEdit || onDelete) && <th className="pb-2 w-16" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="py-2 pr-3 text-xs text-gray-400 font-mono">{p.reference ?? "—"}</td>
              <td className="py-2 pr-3 font-medium text-gray-800">{p.name}</td>
              <td className="py-2 pr-3 text-xs text-gray-500">{p.material_categories?.name ?? "—"}</td>
              <td className="py-2 pr-3 text-xs text-gray-600">{p.unit}</td>
              <td className="py-2 pr-3 text-right font-semibold text-gray-900">
                {p.unit_price_ht != null
                  ? `${p.unit_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
                  : <span className="text-gray-400 font-normal">Sur devis</span>}
              </td>
              <td className="py-2 pr-3 text-center">
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_COLORS[p.source]}`}>
                  {SOURCE_LABELS[p.source]}
                </span>
              </td>
              <td className="py-2 pr-3 text-right text-xs text-gray-400">
                {p.price_updated_at
                  ? new Date(p.price_updated_at).toLocaleDateString("fr-FR")
                  : "—"}
              </td>
              {(onEdit || onDelete) && (
                <td className="py-2">
                  <div className="flex items-center gap-1 justify-end">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(p)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(p.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
