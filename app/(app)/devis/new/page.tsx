"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import type { DevisItemType } from "@/types";
import { DEVIS_ITEM_TYPE_LABELS } from "@/types";
import { VALID_TVA_RATES } from "@/types";

interface LineItem {
  type: DevisItemType;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  tva_rate: number;
}

const UNITS = ["h", "j", "u", "m²", "m³", "ml", "kg", "t", "forfait"];
const DEFAULT_ITEM: LineItem = {
  type: "forfait",
  description: "",
  quantity: 1,
  unit: "u",
  unit_price_ht: 0,
  tva_rate: 10,
};

function computeLine(item: LineItem) {
  const line_ht = Math.round(item.quantity * item.unit_price_ht * 100) / 100;
  const line_tva = Math.round(line_ht * (item.tva_rate / 100) * 100) / 100;
  return { line_ht, line_tva, line_ttc: Math.round((line_ht + line_tva) * 100) / 100 };
}

export default function DevisNewPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_name: "",
    client_address: "",
    client_email: "",
    title: "",
    description: "",
    valid_until: "",
    notes: "",
    work_type: "renovation" as string,
  });
  const [items, setItems] = useState<LineItem[]>([{ ...DEFAULT_ITEM }]);

  const updateItem = useCallback((idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }, []);

  const addItem = () => setItems((prev) => [...prev, { ...DEFAULT_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const totals = items.reduce(
    (acc, item) => {
      const { line_ht, line_tva, line_ttc } = computeLine(item);
      return { ht: acc.ht + line_ht, tva: acc.tva + line_tva, ttc: acc.ttc + line_ttc };
    },
    { ht: 0, tva: 0, ttc: 0 }
  );

  async function handleSubmit(status: "brouillon" | "envoye") {
    if (!form.client_name.trim() || !form.title.trim()) {
      setError("Le nom du client et le titre sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        status,
        total_ht: Math.round(totals.ht * 100) / 100,
        total_tva: Math.round(totals.tva * 100) / 100,
        total_ttc: Math.round(totals.ttc * 100) / 100,
        items: items.map((item, idx) => ({
          ...item,
          position: idx,
          ...computeLine(item),
        })),
      };
      const res = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Erreur serveur");
      }
      const { data } = await res.json();
      router.push(`/devis/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/devis" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nouveau devis</h1>
          <p className="text-sm text-gray-500">Remplissez les informations et ajoutez les lignes</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Client + Devis info */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Informations client</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nom / Raison sociale <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={form.client_name}
                onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                placeholder="M. Dupont / SCI Constructions"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={form.client_email}
                onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
                placeholder="client@email.fr"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={form.client_address}
                onChange={(e) => setForm((f) => ({ ...f, client_address: e.target.value }))}
                placeholder="12 rue de la Paix, 75001 Paris"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Détails du devis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Objet / Titre <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Rénovation salle de bain — 12 rue de la Paix"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valide jusqu&apos;au</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type de travaux</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={form.work_type}
                onChange={(e) => setForm((f) => ({ ...f, work_type: e.target.value }))}
              >
                <option value="neuf">Construction neuve — TVA 20%</option>
                <option value="renovation">Rénovation — TVA 10%</option>
                <option value="renovation_energetique">Rénovation énergétique — TVA 5,5%</option>
                <option value="entretien">Entretien / Réparation — TVA 10%</option>
                <option value="autre">Autre — TVA 20%</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description générale</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description des travaux à réaliser…"
              />
            </div>
          </div>
        </section>

        {/* Line items */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Lignes du devis</h2>
            <button
              onClick={addItem}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              <Plus className="size-4" /> Ajouter une ligne
            </button>
          </div>

          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-[1fr_3fr_80px_80px_100px_80px_100px_36px] gap-2 mb-2 px-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <span>Type</span>
            <span>Description</span>
            <span>Qté</span>
            <span>Unité</span>
            <span>PU HT (€)</span>
            <span>TVA</span>
            <span>Total HT</span>
            <span />
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => {
              const { line_ht } = computeLine(item);
              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-[1fr_3fr_80px_80px_100px_80px_100px_36px] gap-2 items-start"
                >
                  {/* Type */}
                  <select
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={item.type}
                    onChange={(e) => updateItem(idx, { type: e.target.value as DevisItemType })}
                  >
                    {(Object.keys(DEVIS_ITEM_TYPE_LABELS) as DevisItemType[]).map((k) => (
                      <option key={k} value={k}>{DEVIS_ITEM_TYPE_LABELS[k]}</option>
                    ))}
                  </select>

                  {/* Description */}
                  <input
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="Description de la prestation…"
                  />

                  {/* Qty */}
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                  />

                  {/* Unit */}
                  <select
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={item.unit}
                    onChange={(e) => updateItem(idx, { unit: e.target.value })}
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>

                  {/* Unit price */}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={item.unit_price_ht}
                    onChange={(e) => updateItem(idx, { unit_price_ht: parseFloat(e.target.value) || 0 })}
                  />

                  {/* TVA */}
                  <select
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={item.tva_rate}
                    onChange={(e) => updateItem(idx, { tva_rate: parseFloat(e.target.value) })}
                  >
                    {VALID_TVA_RATES.map((r) => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </select>

                  {/* Line total */}
                  <div className="flex items-center justify-end py-1.5 px-2 text-sm font-medium text-gray-900">
                    {line_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Totals */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total HT</span>
                <span className="font-medium">{totals.ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Total TVA</span>
                <span className="font-medium">{totals.tva.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
                <span>Total TTC</span>
                <span>{totals.ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes / Conditions</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Conditions de paiement, délais d'exécution, garanties…"
          />
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pb-4">
          <button
            onClick={() => handleSubmit("brouillon")}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Save className="size-4" />
            Enregistrer en brouillon
          </button>
          <button
            onClick={() => handleSubmit("envoye")}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Marquer comme envoyé"}
          </button>
        </div>
      </div>
    </div>
  );
}
