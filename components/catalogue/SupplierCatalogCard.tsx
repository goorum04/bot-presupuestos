"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Package, ExternalLink, Upload } from "lucide-react";
import { ScrapeStatusBadge } from "./ScrapeStatusBadge";

interface LastJob {
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  completed_at: string | null;
  error_message: string | null;
}

interface SupplierCardData {
  id: string;
  name: string;
  city: string | null;
  website: string | null;
  catalog_url: string | null;
  scrape_enabled: boolean;
  last_scraped_at: string | null;
  product_count: number;
  last_job: LastJob | null;
}

interface SupplierCatalogCardProps {
  supplier: SupplierCardData;
  onRefresh?: (id: string) => Promise<void>;
}

function relativeDate(isoDate: string | null): string {
  if (!isoDate) return "Jamais";
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff < 30) return `il y a ${diff} jour${diff > 1 ? "s" : ""}`;
  if (diff < 365) return `il y a ${Math.floor(diff / 30)} mois`;
  return new Date(isoDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

export function SupplierCatalogCard({ supplier, onRefresh }: SupplierCatalogCardProps) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh(supplier.id);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{supplier.name}</h3>
          {supplier.city && (
            <p className="text-xs text-gray-400 mt-0.5">{supplier.city}</p>
          )}
        </div>
        {supplier.last_job && (
          <ScrapeStatusBadge status={supplier.last_job.status} />
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Package className="size-3.5" />
          <span>{supplier.product_count} produit{supplier.product_count !== 1 ? "s" : ""}</span>
        </span>
        <span>Synchro: {relativeDate(supplier.last_scraped_at)}</span>
      </div>

      {supplier.last_job?.error_message && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 truncate" title={supplier.last_job.error_message}>
          ⚠ {supplier.last_job.error_message}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <Link
          href={`/catalogue/${supplier.id}`}
          className="flex-1 text-center text-xs font-medium text-gray-600 hover:text-amber-600 transition-colors py-1"
        >
          Voir les produits
        </Link>

        {supplier.scrape_enabled ? (
          <button
            onClick={handleRefresh}
            disabled={refreshing || supplier.last_job?.status === "running"}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors py-1"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        ) : (
          <Link
            href={`/catalogue/${supplier.id}/import`}
            className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors py-1"
          >
            <Upload className="size-3.5" />
            Importer CSV
          </Link>
        )}

        {supplier.website && (
          <a
            href={supplier.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600 transition-colors py-1"
            title="Visiter le site"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
