"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, CATEGORY_COLORS, type CategorySlug } from "@/types";
import { formatEUR } from "@/lib/utils";

// ─── Fixed categories ──────────────────────────────────────────────────────

const FIXED_CATEGORIES: { slug: CategorySlug; name: string }[] = [
  { slug: "materiaux", name: CATEGORY_LABELS.materiaux },
  { slug: "main_oeuvre", name: CATEGORY_LABELS.main_oeuvre },
  { slug: "materiel", name: CATEGORY_LABELS.materiel },
  { slug: "sous_traitants", name: CATEGORY_LABELS.sous_traitants },
  { slug: "divers", name: CATEGORY_LABELS.divers },
];

// ─── Field components ──────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, required, children, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

function TextInput({ error, className = "", ...props }: TextInputProps) {
  return (
    <>
      <input
        className={`block w-full rounded-lg border ${
          error ? "border-red-400 ring-1 ring-red-300" : "border-gray-200"
        } bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  total_budget?: string;
  categories?: string;
  submit?: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Project fields
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalBudget, setTotalBudget] = useState("");

  // Category budgets
  const [categoryBudgets, setCategoryBudgets] = useState<
    Record<CategorySlug, string>
  >({
    materiaux: "",
    main_oeuvre: "",
    materiel: "",
    sous_traitants: "",
    divers: "",
  });

  const parsedTotal = parseFloat(totalBudget) || 0;
  const categoryTotal = Object.values(categoryBudgets).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );
  const remaining = parsedTotal - categoryTotal;
  const isOver = categoryTotal > parsedTotal && parsedTotal > 0;

  const handleCategoryChange = useCallback(
    (slug: CategorySlug, value: string) => {
      setCategoryBudgets((prev) => ({ ...prev, [slug]: value }));
    },
    []
  );

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = "Le nom du chantier est obligatoire.";
    if (!totalBudget || parsedTotal <= 0)
      newErrors.total_budget = "Le budget total doit être supérieur à 0.";
    if (isOver)
      newErrors.categories =
        "La répartition dépasse le budget total du chantier.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    const categories = FIXED_CATEGORIES.map(({ slug, name: catName }) => ({
      slug,
      name: catName,
      budget_amount: parseFloat(categoryBudgets[slug]) || 0,
    }));

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          client_name: clientName.trim() || null,
          address: address.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          total_budget: parsedTotal,
          categories,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data?.error ?? "Une erreur est survenue." });
        return;
      }

      const { id } = await res.json();
      router.push(`/projects/${id}`);
    } catch {
      setErrors({ submit: "Impossible de joindre le serveur." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          Retour aux chantiers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Nouveau chantier
        </h1>
        <p className="text-sm text-gray-500">
          Renseignez les informations du chantier et répartissez le budget par
          catégorie.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General info card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Informations générales
          </h2>

          <Field label="Nom du chantier" required>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Rénovation salle de bain — Paris 11"
              error={errors.name}
              autoFocus
            />
          </Field>

          <Field label="Nom du client">
            <TextInput
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex. Martin Dupont"
            />
          </Field>

          <Field label="Adresse du chantier">
            <TextInput
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex. 42 rue de la Paix, 75001 Paris"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date de début">
              <TextInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="Date de fin">
              <TextInput
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </Field>
          </div>

          <Field
            label="Budget total (€)"
            required
            hint="Montant global alloué à ce chantier."
          >
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              placeholder="Ex. 50000"
              error={errors.total_budget}
            />
          </Field>
        </div>

        {/* Budget breakdown card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Répartition du budget par catégorie
            </h2>
          </div>

          {errors.categories && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
              {errors.categories}
            </div>
          )}

          <div className="space-y-4">
            {FIXED_CATEGORIES.map(({ slug, name: catName }) => {
              const color = CATEGORY_COLORS[slug];
              return (
                <div key={slug} className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {catName}
                    </label>
                    <div className="relative">
                      <TextInput
                        type="number"
                        min="0"
                        step="0.01"
                        value={categoryBudgets[slug]}
                        onChange={(e) =>
                          handleCategoryChange(slug, e.target.value)
                        }
                        placeholder="0,00"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                        €
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Running total */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Total catégories</span>
              <span
                className={`font-semibold ${isOver ? "text-red-600" : "text-gray-900"}`}
              >
                {formatEUR(categoryTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Budget total</span>
              <span className="font-semibold text-gray-900">
                {parsedTotal > 0 ? formatEUR(parsedTotal) : "—"}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
              <span className="text-gray-500">Reste à répartir</span>
              <span
                className={`font-bold ${
                  isOver
                    ? "text-red-600"
                    : remaining === 0
                      ? "text-green-600"
                      : "text-amber-600"
                }`}
              >
                {parsedTotal > 0 ? formatEUR(remaining) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Submit error */}
        {errors.submit && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {errors.submit}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-4">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Annuler
          </Link>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="bg-amber-500 hover:bg-amber-600 text-white min-w-32"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Création…
              </>
            ) : (
              "Créer le chantier"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
