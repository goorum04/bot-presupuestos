import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CsvImportForm } from "@/components/catalogue/CsvImportForm";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = await params;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/catalogue/${supplierId}`}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Importer un catalogue CSV</h1>
          <p className="text-sm text-gray-500">
            Chargez les produits et tarifs de ce fournisseur via un fichier CSV
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CsvImportForm supplierId={supplierId} />
      </div>
    </div>
  );
}
