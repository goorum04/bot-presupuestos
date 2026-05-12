"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Upload, X, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatEUR, formatDate } from "@/lib/utils";
import { CATEGORY_LABELS, WORK_TYPE_LABELS, WORK_TYPE_TVA } from "@/types";
import type { Project, BudgetCategory, ExtractedInvoice, WorkType } from "@/types";

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    searchParams.get("project_id") ?? ""
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedWorkType, setSelectedWorkType] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [extracted, setExtracted] = useState<ExtractedInvoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const loadProjects = useCallback(async () => {
    if (projectsLoaded) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("*, budget_categories(*)")
      .eq("status", "active")
      .order("name");
    if (data) {
      setProjects(data);
      setProjectsLoaded(true);
      if (selectedProjectId) {
        const proj = data.find((p) => p.id === selectedProjectId);
        if (proj?.budget_categories) setCategories(proj.budget_categories);
      }
    }
  }, [projectsLoaded, selectedProjectId]);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedCategoryId("");
    const proj = projects.find((p) => p.id === projectId);
    setCategories(proj?.budget_categories ?? []);
  };

  const handleFileChange = (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 8 MB)");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadState("idle");
    setExtracted(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !selectedProjectId) {
      toast.error("Sélectionnez un chantier et une facture");
      return;
    }

    setUploadState("uploading");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("project_id", selectedProjectId);
    if (selectedCategoryId) formData.append("category_id", selectedCategoryId);
    if (selectedWorkType) formData.append("work_type", selectedWorkType);

    try {
      setUploadState("processing");
      const res = await fetch("/api/invoices/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Erreur lors du téléchargement");
      }

      setInvoiceId(json.invoice?.id);

      if (json.ocr_failed) {
        setUploadState("error");
        toast.warning("Facture enregistrée, mais la lecture automatique a échoué. Vous pouvez saisir les données manuellement.");
      } else {
        setExtracted(json.extracted);
        setUploadState("done");
        toast.success("Facture analysée avec succès !");
      }
    } catch (err) {
      setUploadState("error");
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const handleViewInvoice = () => {
    if (invoiceId) router.push(`/invoices/${invoiceId}`);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadState("idle");
    setExtracted(null);
    setInvoiceId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-lg mx-auto p-4 pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ajouter une facture</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Prenez une photo ou importez un fichier
        </p>
      </div>

      {/* Project + Category selectors */}
      <Card className="mb-4">
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label>Chantier *</Label>
            <Select
              value={selectedProjectId}
              onValueChange={(v) => handleProjectChange(v ?? "")}
              onOpenChange={loadProjects}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un chantier…" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {categories.length > 0 && (
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={selectedCategoryId} onValueChange={(v) => setSelectedCategoryId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {CATEGORY_LABELS[c.slug] ?? c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Type de travaux → détermine le taux TVA automatiquement */}
          <div className="space-y-2">
            <Label>Type de travaux</Label>
            <Select value={selectedWorkType} onValueChange={(v) => setSelectedWorkType(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner le type de travaux…" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(WORK_TYPE_LABELS) as [WorkType, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label} — TVA {WORK_TYPE_TVA[k]}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWorkType && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                Taux TVA applicable : <strong>{WORK_TYPE_TVA[selectedWorkType as WorkType]}%</strong> (législation française BTP)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File upload area */}
      {!previewUrl ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-5 md:p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors mb-4"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="font-medium mb-1">Glissez une facture ici</p>
          <p className="text-sm text-muted-foreground mb-4">ou cliquez pour choisir</p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.capture = "environment";
                  fileInputRef.current.click();
                }
              }}
            >
              <Camera size={16} className="mr-1" /> Appareil photo
            </Button>
            <Button variant="outline" size="sm">
              <Upload size={16} className="mr-1" /> Fichier
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={handleInputChange}
          />
          <p className="text-xs text-muted-foreground mt-3">JPEG, PNG, WebP, PDF · max 8 MB</p>
        </div>
      ) : (
        <Card className="mb-4 overflow-hidden">
          <div className="relative">
            <Image
              src={previewUrl}
              alt="Aperçu de la facture"
              width={600}
              height={400}
              className="w-full object-contain max-h-72 bg-muted"
            />
            {uploadState === "idle" && (
              <button
                onClick={handleReset}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <CardContent className="pt-3 pb-3">
            <p className="text-sm text-muted-foreground truncate">{selectedFile?.name}</p>
          </CardContent>
        </Card>
      )}

      {/* Upload / processing button */}
      {uploadState === "idle" && previewUrl && (
        <Button
          className="w-full h-12 text-base"
          onClick={handleSubmit}
          disabled={!selectedProjectId}
        >
          Analyser la facture avec IA
        </Button>
      )}

      {(uploadState === "uploading" || uploadState === "processing") && (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto mb-3 animate-spin text-primary" size={36} />
          <p className="font-medium">
            {uploadState === "uploading" ? "Envoi en cours…" : "Analyse IA en cours…"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            L&apos;IA lit et extrait les données de votre facture
          </p>
        </Card>
      )}

      {/* OCR Result */}
      {uploadState === "done" && extracted && (
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" />
                Données extraites
                <Badge variant="outline" className="ml-auto text-xs">
                  Confiance: {Math.round(extracted.confidence * 100)}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {extracted.supplier_name && (
                <Row label="Fournisseur" value={extracted.supplier_name} />
              )}
              {extracted.invoice_number && (
                <Row label="N° Facture" value={extracted.invoice_number} />
              )}
              {extracted.invoice_date && (
                <Row label="Date" value={formatDate(extracted.invoice_date)} />
              )}
              {extracted.amount_ht != null && (
                <Row label="Montant HT" value={formatEUR(extracted.amount_ht)} />
              )}
              {extracted.tva_rate != null && (
                <Row label="TVA" value={`${extracted.tva_rate}%`} />
              )}
              {extracted.amount_ttc != null && (
                <Row
                  label="Total TTC"
                  value={formatEUR(extracted.amount_ttc)}
                  bold
                />
              )}
              {extracted.extraction_notes && (
                <p className="text-amber-600 text-xs mt-2 flex gap-1">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {extracted.extraction_notes}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleViewInvoice}>
              Voir et valider
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Nouvelle facture
            </Button>
          </div>
        </div>
      )}

      {uploadState === "error" && (
        <div className="space-y-3">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-amber-800">
                La facture a été enregistrée mais la lecture automatique a échoué.
                Vous pouvez saisir les données manuellement.
              </p>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            {invoiceId && (
              <Button className="flex-1" onClick={handleViewInvoice}>
                Saisir manuellement
              </Button>
            )}
            <Button variant="outline" onClick={handleReset}>
              Recommencer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
