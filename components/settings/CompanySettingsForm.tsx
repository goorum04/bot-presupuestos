"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle } from "lucide-react";

interface CompanySettings {
  name: string;
  siret: string;
  tva_number: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
}

const EMPTY: CompanySettings = {
  name: "", siret: "", tva_number: "",
  address: "", postal_code: "", city: "",
  phone: "", email: "",
};

export function CompanySettingsForm() {
  const [form, setForm] = useState<CompanySettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/company")
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setForm({
            name: data.name ?? "",
            siret: data.siret ?? "",
            tva_number: data.tva_number ?? "",
            address: data.address ?? "",
            postal_code: data.postal_code ?? "",
            city: data.city ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
          });
        }
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de la sauvegarde");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const field = (
    label: string,
    key: keyof CompanySettings,
    opts?: { placeholder?: string; hint?: string; type?: string }
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {opts?.hint && <span className="text-gray-400 font-normal ml-1">({opts.hint})</span>}
      </label>
      <input
        type={opts?.type ?? "text"}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={opts?.placeholder ?? ""}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          {field("Raison sociale", "name", { placeholder: "Dupont BTP SARL" })}
        </div>
        {field("SIRET", "siret", { placeholder: "123 456 789 00012", hint: "14 chiffres" })}
        {field("N° TVA intracommunautaire", "tva_number", { placeholder: "FR12345678901" })}
        <div className="md:col-span-2">
          {field("Adresse", "address", { placeholder: "12 rue de la Paix" })}
        </div>
        {field("Code postal", "postal_code", { placeholder: "75001" })}
        {field("Ville", "city", { placeholder: "Paris" })}
        {field("Téléphone", "phone", { placeholder: "+33 6 12 34 56 78" })}
        {field("Email professionnel", "email", { placeholder: "contact@entreprise.fr", type: "email" })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Sauvegarde…" : "Enregistrer"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="size-4" /> Sauvegardé
          </span>
        )}
      </div>
    </div>
  );
}
