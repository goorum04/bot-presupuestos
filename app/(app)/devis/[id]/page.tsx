import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, CheckCircle, XCircle, Send, FileText } from "lucide-react";
import type { Devis, DevisStatus } from "@/types";
import { DEVIS_STATUS_LABELS, DEVIS_ITEM_TYPE_LABELS } from "@/types";
import { formatEUR } from "@/lib/utils";
import { DevisStatusActions } from "@/components/devis/DevisStatusActions";

const STATUS_BADGE: Record<DevisStatus, string> = {
  brouillon: "bg-gray-100 text-gray-700",
  envoye: "bg-blue-100 text-blue-700",
  accepte: "bg-green-100 text-green-700",
  refuse: "bg-red-100 text-red-700",
  expire: "bg-orange-100 text-orange-700",
};

export default async function DevisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devis")
    .select("*, devis_items(*), projects(id, name)")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const devis = data as Devis & { devis_items: NonNullable<Devis["devis_items"]> };
  const items = [...(devis.devis_items ?? [])].sort((a, b) => a.position - b.position);

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/devis" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400">{devis.number}</span>
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[devis.status]}`}>
                {DEVIS_STATUS_LABELS[devis.status]}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{devis.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/devis/${id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer className="size-4" /> Imprimer
          </Link>
          <Link
            href={`/devis/new?copy=${id}`}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="size-4" /> Dupliquer
          </Link>
        </div>
      </div>

      {/* Status actions */}
      <DevisStatusActions devisId={id} currentStatus={devis.status} />

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Client</p>
          <p className="font-semibold text-gray-900">{devis.client_name}</p>
          {devis.client_email && <p className="text-sm text-gray-500">{devis.client_email}</p>}
          {devis.client_address && <p className="text-sm text-gray-500">{devis.client_address}</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Devis</p>
          <div className="text-sm space-y-0.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="text-gray-900">{new Date(devis.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
            {devis.valid_until && (
              <div className="flex justify-between">
                <span className="text-gray-500">Valide jusqu&apos;au</span>
                <span className="text-gray-900">{new Date(devis.valid_until).toLocaleDateString("fr-FR")}</span>
              </div>
            )}
            {devis.projects && (
              <div className="flex justify-between">
                <span className="text-gray-500">Chantier</span>
                <Link href={`/projects/${devis.projects.id}`} className="text-amber-600 hover:underline">
                  {devis.projects.name}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Détail des prestations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Qté</th>
                <th className="px-4 py-2 text-right">U</th>
                <th className="px-4 py-2 text-right">PU HT</th>
                <th className="px-4 py-2 text-right">TVA</th>
                <th className="px-4 py-2 text-right">Total HT</th>
                <th className="px-4 py-2 text-right">Total TTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                      {DEVIS_ITEM_TYPE_LABELS[item.type]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{item.description}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{item.unit}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{formatEUR(item.unit_price_ht)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{item.tva_rate}%</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-800">{formatEUR(item.line_ht)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatEUR(item.line_ttc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Totals */}
        <div className="border-t border-gray-200 px-4 py-3 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total HT</span>
              <span>{formatEUR(devis.total_ht)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total TVA</span>
              <span>{formatEUR(devis.total_tva)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total TTC</span>
              <span>{formatEUR(devis.total_ttc)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {devis.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes / Conditions</p>
          <p className="whitespace-pre-line">{devis.notes}</p>
        </div>
      )}
    </div>
  );
}
