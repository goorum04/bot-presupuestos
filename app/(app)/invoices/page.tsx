import Link from "next/link";
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatEUR, formatDate, truncate } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/types";
import type { Invoice, CategorySlug } from "@/types";

const OCR_STATUS_CONFIG = {
  pending: { label: "En attente", icon: Clock, color: "text-gray-500" },
  processing: { label: "Analyse…", icon: Clock, color: "text-blue-500" },
  completed: { label: "Complété", icon: CheckCircle, color: "text-green-500" },
  failed: { label: "Échec", icon: XCircle, color: "text-red-500" },
  needs_review: { label: "À réviser", icon: AlertTriangle, color: "text-amber-500" },
};

export default async function InvoicesPage() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(`*, projects(id, name), budget_categories(id, name, slug)`)
    .order("created_at", { ascending: false })
    .limit(100);

  const pending = invoices?.filter((i) => !i.is_validated && i.ocr_status !== "failed").length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Factures</h1>
          {pending > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {pending} facture{pending > 1 ? "s" : ""} en attente de validation
            </p>
          )}
        </div>
        <Link href="/invoices/upload">
          <Button>
            <Plus size={16} className="mr-2" />
            Ajouter
          </Button>
        </Link>
      </div>

      {!invoices?.length ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice as Invoice} />
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const statusCfg = OCR_STATUS_CONFIG[invoice.ocr_status] ?? OCR_STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <Link href={`/invoices/${invoice.id}`}>
      <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted shrink-0">
              <FileText size={18} className="text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm truncate">
                  {invoice.supplier_name
                    ? truncate(invoice.supplier_name, 35)
                    : "Fournisseur inconnu"}
                </span>
                {invoice.invoice_number && (
                  <span className="text-xs text-muted-foreground">
                    n°{invoice.invoice_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {invoice.projects && (
                  <span className="truncate">{invoice.projects.name}</span>
                )}
                {invoice.budget_categories && (
                  <>
                    <span>·</span>
                    <span>
                      {CATEGORY_LABELS[invoice.budget_categories.slug as CategorySlug] ??
                        invoice.budget_categories.name}
                    </span>
                  </>
                )}
                <span>·</span>
                <span>{formatDate(invoice.created_at)}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              {invoice.amount_ttc != null && (
                <span className="font-semibold text-sm">
                  {formatEUR(invoice.amount_ttc)}
                </span>
              )}
              <div className={`flex items-center gap-1 text-xs ${statusCfg.color}`}>
                <StatusIcon size={12} />
                {statusCfg.label}
              </div>
            </div>

            {invoice.is_validated && (
              <Badge variant="outline" className="text-green-600 border-green-200 shrink-0">
                Validée
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">Aucune facture</h3>
      <p className="text-muted-foreground mb-6">
        Commencez par ajouter la première facture d&apos;un chantier.
      </p>
      <Link href="/invoices/upload">
        <Button>
          <Plus size={16} className="mr-2" />
          Ajouter une facture
        </Button>
      </Link>
    </div>
  );
}
