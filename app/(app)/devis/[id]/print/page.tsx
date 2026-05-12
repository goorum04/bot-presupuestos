import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Devis } from "@/types";
import { DEVIS_ITEM_TYPE_LABELS } from "@/types";
import { formatEUR } from "@/lib/utils";

export default async function DevisPrintPage({ params }: { params: Promise<{ id: string }> }) {
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
  const today = new Date().toLocaleDateString("fr-FR");

  // Group TVA lines for tax breakdown
  const tvaBreakdown: Record<number, { ht: number; tva: number }> = {};
  for (const item of items) {
    if (!tvaBreakdown[item.tva_rate]) tvaBreakdown[item.tva_rate] = { ht: 0, tva: 0 };
    tvaBreakdown[item.tva_rate].ht += item.line_ht;
    tvaBreakdown[item.tva_rate].tva += item.line_tva;
  }

  return (
    <>
      {/* Print styles injected inline — no external CSS dependency */}
      <style>{`
        @media print {
          @page { margin: 15mm 15mm 20mm 15mm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; }
      `}</style>

      {/* Print button (hidden when printing) */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 shadow-md"
        >
          Imprimer / PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-md"
        >
          Fermer
        </button>
      </div>

      <div className="max-w-[210mm] mx-auto px-8 py-8 bg-white min-h-screen">
        {/* Header: company + client */}
        <div className="flex justify-between items-start mb-8">
          {/* Company info (placeholder — to be configured in settings) */}
          <div>
            <div className="text-lg font-bold text-amber-600 mb-1">PresupuestoPro BTP</div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>Votre adresse professionnelle</p>
              <p>Code postal, Ville</p>
              <p>Tél : +33 X XX XX XX XX</p>
              <p>SIRET : XX XXX XXX XXXXX</p>
            </div>
          </div>

          {/* Devis title block */}
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">DEVIS</div>
            <div className="text-sm text-gray-500 mt-0.5">{devis.number}</div>
            <div className="text-xs text-gray-400 mt-1">Date : {today}</div>
            {devis.valid_until && (
              <div className="text-xs text-gray-400">
                Valide jusqu&apos;au : {new Date(devis.valid_until).toLocaleDateString("fr-FR")}
              </div>
            )}
          </div>
        </div>

        {/* Client block */}
        <div className="flex justify-end mb-8">
          <div className="border border-gray-200 rounded p-3 min-w-[200px]">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Destinataire</p>
            <p className="font-semibold text-gray-900">{devis.client_name}</p>
            {devis.client_address && <p className="text-xs text-gray-600 mt-0.5">{devis.client_address}</p>}
            {devis.client_email && <p className="text-xs text-gray-500 mt-0.5">{devis.client_email}</p>}
          </div>
        </div>

        {/* Subject */}
        <div className="mb-6">
          <p className="text-sm">
            <span className="font-semibold">Objet :</span> {devis.title}
          </p>
          {devis.description && (
            <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{devis.description}</p>
          )}
        </div>

        {/* Line items table */}
        <table className="w-full text-xs mb-6" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f59e0b", color: "#fff" }}>
              <th className="px-2 py-1.5 text-left font-semibold">Désignation</th>
              <th className="px-2 py-1.5 text-center font-semibold w-12">Qté</th>
              <th className="px-2 py-1.5 text-center font-semibold w-10">U</th>
              <th className="px-2 py-1.5 text-right font-semibold w-20">PU HT</th>
              <th className="px-2 py-1.5 text-center font-semibold w-12">TVA</th>
              <th className="px-2 py-1.5 text-right font-semibold w-20">Total HT</th>
              <th className="px-2 py-1.5 text-right font-semibold w-20">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f0f0f0" }}
              >
                <td className="px-2 py-1.5">
                  <span className="font-medium">{item.description}</span>
                  <span className="text-[9px] text-gray-400 ml-1">({DEVIS_ITEM_TYPE_LABELS[item.type]})</span>
                </td>
                <td className="px-2 py-1.5 text-center">{item.quantity}</td>
                <td className="px-2 py-1.5 text-center text-gray-500">{item.unit}</td>
                <td className="px-2 py-1.5 text-right">{formatEUR(item.unit_price_ht)}</td>
                <td className="px-2 py-1.5 text-center text-gray-500">{item.tva_rate}%</td>
                <td className="px-2 py-1.5 text-right font-medium">{formatEUR(item.line_ht)}</td>
                <td className="px-2 py-1.5 text-right font-medium">{formatEUR(item.line_ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + TVA breakdown */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            {/* TVA breakdown */}
            <table className="w-full text-xs mb-2" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6" }}>
                  <th className="px-2 py-1 text-left font-medium text-gray-500">Taux TVA</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500">Base HT</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500">TVA</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tvaBreakdown).map(([rate, amounts]) => (
                  <tr key={rate} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td className="px-2 py-1 text-gray-600">{rate}%</td>
                    <td className="px-2 py-1 text-right">{formatEUR(amounts.ht)}</td>
                    <td className="px-2 py-1 text-right">{formatEUR(amounts.tva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Grand total */}
            <div className="space-y-1 border-t border-gray-300 pt-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Total HT</span><span>{formatEUR(devis.total_ht)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Total TVA</span><span>{formatEUR(devis.total_tva)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-900 pt-1">
                <span>TOTAL TTC</span><span>{formatEUR(devis.total_ttc)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes / Conditions */}
        {devis.notes && (
          <div className="border-t border-gray-200 pt-4 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Conditions</p>
            <p className="text-xs text-gray-600 whitespace-pre-line">{devis.notes}</p>
          </div>
        )}

        {/* Legal footer */}
        <div className="border-t border-gray-200 pt-4 mt-8">
          <p className="text-[9px] text-gray-400 text-center">
            Devis valable 30 jours à compter de sa date d&apos;émission — TVA applicable selon art. 279-0 bis et 279-0 bis A du CGI —
            En cas d&apos;acceptation, veuillez retourner ce devis signé avec la mention &laquo;&nbsp;Bon pour accord&nbsp;&raquo;
          </p>
        </div>

        {/* Signature block */}
        <div className="flex justify-between mt-10 gap-8">
          <div className="flex-1 border border-gray-300 rounded p-3 min-h-[80px]">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Signature entreprise</p>
          </div>
          <div className="flex-1 border border-gray-300 rounded p-3 min-h-[80px]">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">
              Bon pour accord — Signature client
            </p>
            <p className="text-[9px] text-gray-400 mt-1">Date :</p>
          </div>
        </div>
      </div>
    </>
  );
}
