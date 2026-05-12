"use client";

import { useState, useRef } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react";

interface CsvImportFormProps {
  supplierId: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const CSV_EXAMPLE = `reference,name,description,unit,unit_price_ht,category_slug
CEM-001,Ciment Portland CEM II 25kg,,sac,8.50,ciment_beton
ISO-012,Laine de roche 100mm,,m²,12.90,isolation`;

export function CsvImportForm({ supplierId }: CsvImportFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f?.name.endsWith(".csv")) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/catalogue/import/${supplierId}`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'importation");
      setResult(json.result);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Format attendu</h3>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 overflow-x-auto">
          {CSV_EXAMPLE}
        </pre>
        <p className="text-xs text-gray-400 mt-1">
          Colonnes obligatoires : <code>name</code>, <code>unit</code>. Les autres sont optionnelles.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          className="relative border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-amber-400 transition-colors cursor-pointer"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="sr-only"
          />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
              <FileText className="size-5 text-amber-500" />
              <span className="font-medium">{file.name}</span>
              <span className="text-gray-400">({(file.size / 1024).toFixed(1)} Ko)</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="ml-1 text-gray-400 hover:text-red-500"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="text-gray-400">
              <Upload className="size-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Glissez un fichier CSV ici ou cliquez pour parcourir</p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Importation en cours…" : "Importer les produits"}
        </button>
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
            <CheckCircle className="size-4" /> Importation réussie
          </div>
          <ul className="text-sm text-green-700 space-y-0.5">
            <li>• {result.inserted} produit(s) ajouté(s)</li>
            <li>• {result.updated} produit(s) mis à jour</li>
            {result.skipped > 0 && <li>• {result.skipped} ligne(s) ignorée(s)</li>}
          </ul>
          {result.errors.length > 0 && (
            <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
              {result.errors.map((e, i) => <li key={i}>⚠ {e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
