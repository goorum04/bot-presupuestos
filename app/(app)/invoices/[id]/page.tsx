"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, XCircle, AlertTriangle,
  FileText, Calendar, Building2, Hash, Euro
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatEUR, formatDate, formatSIRET } from "@/lib/utils";
import type { Invoice } from "@/types";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Partial<Invoice>>({});

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) { router.push("/invoices"); return; }
      const { invoice: inv, image_url } = await res.json();
      setInvoice(inv);
      setImageUrl(image_url);
      setLoading(false);
    }
    load();
  }, [invoiceId, router]);

  const handleChange = (field: keyof Invoice, value: string | number | null) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!Object.keys(edits).length) return;
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits),
    });
    if (res.ok) {
      const { invoice: updated } = await res.json();
      setInvoice(updated);
      setEdits({});
      toast.success("Facture mise à jour");
    } else {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  const handleValidate = async () => {
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_validated: true, ...edits }),
    });
    if (res.ok) {
      const { invoice: updated } = await res.json();
      setInvoice(updated);
      setEdits({});
      toast.success("Facture validée !");
    } else {
      toast.error("Erreur lors de la validation");
    }
    setSaving(false);
  };

  const handleReject = async () => {
    if (!confirm("Rejeter cette facture ?")) return;
    setSaving(true);
    await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocr_status: "failed", notes: "Rejetée manuellement" }),
    });
    toast.info("Facture rejetée");
    router.push("/invoices");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!invoice) return null;

  const val = (field: keyof Invoice) =>
    edits[field] !== undefined ? String(edits[field] ?? "") : String(invoice[field] ?? "");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} className="mr-1" /> Retour
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {invoice.supplier_name ?? "Facture sans fournisseur"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {invoice.projects?.name} · Ajoutée le {formatDate(invoice.created_at)}
          </p>
        </div>
        <StatusBadge invoice={invoice} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: image + validation actions */}
        <div className="space-y-4">
          {imageUrl ? (
            <Card className="overflow-hidden">
              <Image
                src={imageUrl}
                alt="Facture"
                width={600}
                height={800}
                className="w-full object-contain max-h-96 bg-muted"
              />
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
                <FileText size={48} />
              </CardContent>
            </Card>
          )}

          {!invoice.is_validated && (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleValidate}
                disabled={saving}
              >
                <CheckCircle size={16} className="mr-2" />
                Valider
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving || !Object.keys(edits).length}
              >
                Sauvegarder
              </Button>
              <Button variant="ghost" size="icon" onClick={handleReject} disabled={saving}>
                <XCircle size={16} className="text-red-500" />
              </Button>
            </div>
          )}

          {invoice.is_validated && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-3 pb-3 flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle size={16} />
                Validée le {formatDate(invoice.validated_at)}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: extracted data (editable) */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 size={16} /> Fournisseur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Nom"
                value={val("supplier_name")}
                onChange={(v) => handleChange("supplier_name", v)}
              />
              <Field
                label="SIRET"
                value={formatSIRET(val("supplier_siret"))}
                onChange={(v) => handleChange("supplier_siret", v.replace(/\s/g, ""))}
                placeholder="XXX XXX XXX XXXXX"
              />
              <Field
                label="Adresse"
                value={val("supplier_address")}
                onChange={(v) => handleChange("supplier_address", v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hash size={16} /> Facture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                label="Numéro"
                value={val("invoice_number")}
                onChange={(v) => handleChange("invoice_number", v)}
              />
              <Field
                label="Date"
                value={val("invoice_date")}
                onChange={(v) => handleChange("invoice_date", v)}
                type="date"
              />
              <Field
                label="Échéance"
                value={val("due_date")}
                onChange={(v) => handleChange("due_date", v)}
                type="date"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Euro size={16} /> Montants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Montant HT (€)"
                  value={val("amount_ht")}
                  onChange={(v) => handleChange("amount_ht", parseFloat(v) || null)}
                  type="number"
                />
                <Field
                  label="Taux TVA (%)"
                  value={val("tva_rate")}
                  onChange={(v) => handleChange("tva_rate", parseFloat(v) || null)}
                  type="number"
                />
                <Field
                  label="Montant TVA (€)"
                  value={val("tva_amount")}
                  onChange={(v) => handleChange("tva_amount", parseFloat(v) || null)}
                  type="number"
                />
                <Field
                  label="Total TTC (€)"
                  value={val("amount_ttc")}
                  onChange={(v) => handleChange("amount_ttc", parseFloat(v) || null)}
                  type="number"
                />
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-semibold">
                <span>Total TTC</span>
                <span>{formatEUR(invoice.amount_ttc)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar size={16} /> Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={val("notes")}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange("notes", e.target.value)}
                placeholder="Observations, remarques…"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
        step={type === "number" ? "0.01" : undefined}
      />
    </div>
  );
}

function StatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.is_validated) {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Validée</Badge>;
  }
  if (invoice.ocr_status === "needs_review") {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex gap-1"><AlertTriangle size={12} />À réviser</Badge>;
  }
  if (invoice.ocr_status === "failed") {
    return <Badge variant="destructive">Échec OCR</Badge>;
  }
  return <Badge variant="outline">En attente</Badge>;
}
