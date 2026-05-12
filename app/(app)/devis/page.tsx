import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, FileText, Clock } from "lucide-react";
import type { Devis, DevisStatus } from "@/types";
import { DEVIS_STATUS_LABELS } from "@/types";
import { formatEUR } from "@/lib/utils";

const STATUS_BADGE: Record<DevisStatus, string> = {
  brouillon: "bg-gray-100 text-gray-700",
  envoye: "bg-blue-100 text-blue-700",
  accepte: "bg-green-100 text-green-700",
  refuse: "bg-red-100 text-red-700",
  expire: "bg-orange-100 text-orange-700",
};

export default async function DevisPage() {
  const supabase = await createClient();
  const { data: devisList } = await supabase
    .from("devis")
    .select("*, projects(id, name)")
    .order("created_at", { ascending: false });

  const items = (devisList ?? []) as Devis[];

  const stats = {
    total: items.length,
    accepte: items.filter((d) => d.status === "accepte").length,
    envoye: items.filter((d) => d.status === "envoye").length,
    totalTtc: items
      .filter((d) => d.status === "accepte")
      .reduce((s, d) => s + d.total_ttc, 0),
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez vos devis et estimations</p>
        </div>
        <Link
          href="/devis/new"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
        >
          <Plus className="size-4" />
          Nouveau devis
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total devis", value: stats.total, color: "text-gray-900" },
          { label: "Envoyés", value: stats.envoye, color: "text-blue-600" },
          { label: "Acceptés", value: stats.accepte, color: "text-green-600" },
          { label: "CA accepté", value: formatEUR(stats.totalTtc), color: "text-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
            <FileText className="size-7 text-amber-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Aucun devis</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-4">
            Créez votre premier devis pour chiffrer une intervention.
          </p>
          <Link
            href="/devis/new"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            <Plus className="size-4" /> Créer un devis
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {items.map((devis) => (
            <Link
              key={devis.id}
              href={`/devis/${devis.id}`}
              className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 shrink-0">
                <FileText className="size-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">{devis.number}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[devis.status]}`}
                  >
                    {DEVIS_STATUS_LABELS[devis.status]}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{devis.title}</p>
                <p className="text-xs text-gray-500 truncate">{devis.client_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatEUR(devis.total_ttc)}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400 justify-end mt-0.5">
                  <Clock className="size-3" />
                  {new Date(devis.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
