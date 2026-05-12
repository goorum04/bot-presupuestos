"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Printer, Pencil, Save, X, Plus, Trash2, Download, Mail, Loader2,
} from "lucide-react";
import type { Devis, DevisItem, DevisStatus, DevisItemType, WorkType } from "@/types";
import { DEVIS_STATUS_LABELS, DEVIS_ITEM_TYPE_LABELS, VALID_TVA_RATES, WORK_TYPE_TVA } from "@/types";
import { formatEUR } from "@/lib/utils";
import { DevisStatusActions } from "./DevisStatusActions";

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<DevisStatus, string> = {
  brouillon: "bg-gray-100 text-gray-700",
  envoye: "bg-blue-100 text-blue-700",
  accepte: "bg-green-100 text-green-700",
  refuse: "bg-red-100 text-red-700",
  expire: "bg-orange-100 text-orange-700",
};

const UNITS = ["h", "j", "u", "m²", "m³", "ml", "kg", "t", "forfait"];

interface LineItem {
  type: DevisItemType;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  tva_rate: number;
}

function computeLine(item: LineItem) {
  const line_ht = Math.round(item.quantity * item.unit_price_ht * 100) / 100;
  const line_tva = Math.round(line_ht * (item.tva_rate / 100) * 100) / 100;
  return { line_ht, line_tva, line_ttc: Math.round((line_ht + line_tva) * 100) / 100 };
}

function itemsToLineItems(items: DevisItem[]): LineItem[] {
  return items.map((it) => ({
    type: it.type,
    description: it.description,
    quantity: it.quantity,
    unit: it.unit,
    unit_price_ht: it.unit_price_ht,
    tva_rate: it.tva_rate,
  }));
}

// ─── component ───────────────────────────────────────────────────────────────

type DevisWithItems = Devis & { devis_items: DevisItem[] };

interface Props {
  devis: DevisWithItems;
}

export function DevisDetailClient({ devis }: Props) {
  const router = useRouter();
  const sortedItems = [...devis.devis_items].sort((a, b) => a.position - b.position);

  const initialForm = {
    client_name: devis.client_name,
    client_address: devis.client_address ?? "",
    client_email: devis.client_email ?? "",
    title: devis.title,
    description: devis.description ?? "",
    valid_until: devis.valid_until ?? "",
    notes: devis.notes ?? "",
  };

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [workType, setWorkType] = useState("renovation");
  const [items, setItems] = useState<LineItem[]>(itemsToLineItems(sortedItems));
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateItem = useCallback((idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }, []);

  function handleWorkTypeChange(newType: string) {
    setWorkType(newType);
    const rate = WORK_TYPE_TVA[newType as WorkType] ?? 20;
    setItems((prev) => prev.map((it) => ({ ...it, tva_rate: rate })));
  }

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { type: "forfait", description: "", quantity: 1, unit: "u", unit_price_ht: 0, tva_rate: WORK_TYPE_TVA[workType as WorkType] ?? 20 },
    ]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const totals = items.reduce(
    (acc, item) => {
      const { line_ht, line_tva, line_ttc } = computeLine(item);
      return { ht: acc.ht + line_ht, tva: acc.tva + line_tva, ttc: acc.ttc + line_ttc };
    },
    { ht: 0, tva: 0, ttc: 0 }
  );

  async function handleSendEmail() {
    setSendingEmail(true);
    setEmailMsg(null);
    try {
      const res = await fetch(`/api/devis/${devis.id}/email`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur envoi");
      setEmailMsg({ ok: true, text: `Email envoyé à ${devis.client_email} ✓` });
      router.refresh();
    } catch (e) {
      setEmailMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setSendingEmail(false);
    }
  }

  function handleCancel() {
    setForm(initialForm);
    setItems(itemsToLineItems(sortedItems));
    setError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    if (!form.client_name.trim() || !form.title.trim()) {
      setError("Le nom du client et le titre sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        total_ht: Math.round(totals.ht * 100) / 100,
        total_tva: Math.round(totals.tva * 100) / 100,
        total_ttc: Math.round(totals.ttc * 100) / 100,
        items: items.map((item, idx) => ({
          ...item,
          position: idx,
          ...computeLine(item),
        })),
      };
      const res = await fetch(`/api/devis/${devis.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Erreur serveur");
      }
      setIsEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

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
            <h1 className="text-xl font-bold text-gray-900">
              {isEditing ? form.title || <span className="text-gray-400">Titre…</span> : devis.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <X className="size-4" /> Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                <Save className="size-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="size-4" /> Modifier
              </button>
              <a
                href={`/api/devis/${devis.id}/pdf`}
                download={`${devis.number}.pdf`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download className="size-4" /> PDF
              </a>
              <Link
                href={`/devis/${devis.id}/print`}
                target="_blank"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Printer className="size-4" /> Imprimer
              </Link>
              {devis.client_email && (
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {sendingEmail ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                  {sendingEmail ? "Envoi…" : "Envoyer"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Email feedback */}
      {emailMsg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm border ${emailMsg.ok ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {emailMsg.text}
        </div>
      )}

      {/* Status actions (always visible) */}
      <DevisStatusActions devisId={devis.id} currentStatus={devis.status} />

      {/* ── VIEW MODE ──────────────────────────────────────────────────────── */}
      {!isEditing && (
        <>
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
                  {sortedItems.map((item) => (
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
            <div className="border-t border-gray-200 px-4 py-3 flex justify-end">
              <TotalsSummary ht={devis.total_ht} tva={devis.total_tva} ttc={devis.total_ttc} />
            </div>
          </div>

          {devis.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes / Conditions</p>
              <p className="whitespace-pre-line">{devis.notes}</p>
            </div>
          )}
        </>
      )}

      {/* ── EDIT MODE ──────────────────────────────────────────────────────── */}
      {isEditing && (
        <div className="space-y-5">
          {/* Client info */}
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
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={form.client_email}
                  onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={form.client_address}
                  onChange={(e) => setForm((f) => ({ ...f, client_address: e.target.value }))}
                />
              </div>
            </div>
          </section>

          {/* Devis info */}
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
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Type de travaux <span className="text-amber-500 text-[10px] font-normal">(met à jour la TVA de toutes les lignes)</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={workType}
                  onChange={(e) => handleWorkTypeChange(e.target.value)}
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

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    <th className="pb-2 text-left font-medium w-36">Type</th>
                    <th className="pb-2 text-left font-medium">Description</th>
                    <th className="pb-2 text-right font-medium w-16">Qté</th>
                    <th className="pb-2 text-left font-medium w-16 pl-2">Unité</th>
                    <th className="pb-2 text-right font-medium w-24">PU HT (€)</th>
                    <th className="pb-2 text-right font-medium w-16">TVA</th>
                    <th className="pb-2 text-right font-medium w-24">Total HT</th>
                    <th className="pb-2 w-9" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const { line_ht } = computeLine(item);
                    return (
                      <tr key={idx}>
                        <td className="py-1.5 pr-2">
                          <select
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                            value={item.type}
                            onChange={(e) => updateItem(idx, { type: e.target.value as DevisItemType })}
                          >
                            {(Object.keys(DEVIS_ITEM_TYPE_LABELS) as DevisItemType[]).map((k) => (
                              <option key={k} value={k}>{DEVIS_ITEM_TYPE_LABELS[k]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            value={item.description}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                            placeholder="Description…"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number" min="0" step="0.001"
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                            value={item.unit}
                            onChange={(e) => updateItem(idx, { unit: e.target.value })}
                          >
                            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number" min="0" step="0.01"
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                            value={item.unit_price_ht}
                            onChange={(e) => updateItem(idx, { unit_price_ht: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                            value={item.tva_rate}
                            onChange={(e) => updateItem(idx, { tva_rate: parseFloat(e.target.value) })}
                          >
                            {VALID_TVA_RATES.map((r) => (
                              <option key={r} value={r}>{r}%</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 pr-2 text-right text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {line_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                        </td>
                        <td className="py-1.5">
                          <button
                            onClick={() => removeItem(idx)}
                            disabled={items.length === 1}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {items.map((item, idx) => {
                const { line_ht } = computeLine(item);
                return (
                  <div key={idx} className="rounded-lg border border-gray-200 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                        value={item.type}
                        onChange={(e) => updateItem(idx, { type: e.target.value as DevisItemType })}
                      >
                        {(Object.keys(DEVIS_ITEM_TYPE_LABELS) as DevisItemType[]).map((k) => (
                          <option key={k} value={k}>{DEVIS_ITEM_TYPE_LABELS[k]}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="Description…"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">Qté</p>
                        <input
                          type="number" min="0" step="0.001"
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">Unité</p>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                          value={item.unit}
                          onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        >
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">PU HT (€)</p>
                        <input
                          type="number" min="0" step="0.01"
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                          value={item.unit_price_ht}
                          onChange={(e) => updateItem(idx, { unit_price_ht: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">TVA</p>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                          value={item.tva_rate}
                          onChange={(e) => updateItem(idx, { tva_rate: parseFloat(e.target.value) })}
                        >
                          {VALID_TVA_RATES.map((r) => (
                            <option key={r} value={r}>{r}%</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end text-sm font-semibold text-gray-900">
                      Total HT : {line_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Live totals */}
          <section className="bg-white rounded-xl border border-gray-200 p-5 flex justify-end">
            <TotalsSummary ht={totals.ht} tva={totals.tva} ttc={totals.ttc} />
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
        </div>
      )}
    </div>
  );
}

function TotalsSummary({ ht, tva, ttc }: { ht: number; tva: number; ttc: number }) {
  return (
    <div className="w-full max-w-xs space-y-1.5 text-sm">
      <div className="flex justify-between text-gray-600">
        <span>Total HT</span>
        <span>{formatEUR(ht)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Total TVA</span>
        <span>{formatEUR(tva)}</span>
      </div>
      <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
        <span>Total TTC</span>
        <span>{formatEUR(ttc)}</span>
      </div>
    </div>
  );
}
