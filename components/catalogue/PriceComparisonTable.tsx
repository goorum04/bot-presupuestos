interface CompareRow {
  supplier_name: string;
  product_name: string;
  reference: string | null;
  unit: string;
  unit_price_ht: number;
  price_updated_at: string | null;
  source: string;
}

interface PriceComparisonTableProps {
  rows: CompareRow[];
}

export function PriceComparisonTable({ rows }: PriceComparisonTableProps) {
  const sorted = [...rows].sort((a, b) => a.unit_price_ht - b.unit_price_ht);
  const best = sorted[0]?.unit_price_ht;

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Aucun résultat pour cette recherche.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <th className="pb-2 text-left font-medium">Fournisseur</th>
            <th className="pb-2 text-left font-medium">Désignation</th>
            <th className="pb-2 text-left font-medium w-16">Unité</th>
            <th className="pb-2 text-right font-medium w-28">Prix HT</th>
            <th className="pb-2 text-right font-medium w-28">Prix au</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((r, i) => (
            <tr key={i} className={i === 0 ? "bg-green-50/60" : "hover:bg-gray-50/50"}>
              <td className="py-2 pr-3 font-medium text-gray-800">{r.supplier_name}</td>
              <td className="py-2 pr-3 text-gray-600 text-xs">
                {r.product_name}
                {r.reference && <span className="ml-1 text-gray-400">({r.reference})</span>}
              </td>
              <td className="py-2 pr-3 text-xs text-gray-600">{r.unit}</td>
              <td className="py-2 pr-3 text-right">
                <span className={`font-bold ${i === 0 ? "text-green-700" : "text-gray-800"}`}>
                  {r.unit_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </span>
                {i === 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold text-green-600 bg-green-100 px-1 rounded">
                    Meilleur prix
                  </span>
                )}
                {i > 0 && best && (
                  <span className="ml-1.5 text-[10px] text-gray-400">
                    +{((r.unit_price_ht - best) / best * 100).toFixed(1)}%
                  </span>
                )}
              </td>
              <td className="py-2 pr-3 text-right text-xs text-gray-400">
                {r.price_updated_at
                  ? new Date(r.price_updated_at).toLocaleDateString("fr-FR")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
