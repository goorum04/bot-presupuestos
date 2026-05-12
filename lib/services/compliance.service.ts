import type { Invoice, ComplianceIssue } from "@/types";
import { VALID_TVA_RATES } from "@/types";

// French invoice mandatory fields (art. 289 CGI)
export function checkInvoiceCompliance(invoice: Partial<Invoice>): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  // Numéro de facture obligatoire
  if (!invoice.invoice_number?.trim()) {
    issues.push({
      code: "MISSING_INVOICE_NUMBER",
      message: "Numéro de facture manquant (obligatoire par la loi française)",
      severity: "error",
    });
  }

  // Date de facture obligatoire
  if (!invoice.invoice_date) {
    issues.push({
      code: "MISSING_INVOICE_DATE",
      message: "Date de facture manquante (mention obligatoire)",
      severity: "error",
    });
  }

  // Nom du fournisseur obligatoire
  if (!invoice.supplier_name?.trim()) {
    issues.push({
      code: "MISSING_SUPPLIER_NAME",
      message: "Raison sociale du fournisseur manquante",
      severity: "error",
    });
  }

  // SIRET : 14 chiffres exactement
  if (!invoice.supplier_siret) {
    issues.push({
      code: "MISSING_SIRET",
      message: "Numéro SIRET manquant (14 chiffres obligatoires en France)",
      severity: "error",
    });
  } else {
    const siret = invoice.supplier_siret.replace(/\s/g, "");
    if (!/^\d{14}$/.test(siret)) {
      issues.push({
        code: "INVALID_SIRET",
        message: `SIRET invalide "${invoice.supplier_siret}" — doit contenir exactement 14 chiffres`,
        severity: "error",
      });
    }
  }

  // N° TVA intracommunautaire : FR + 11 caractères
  if (invoice.supplier_tva_num) {
    const tva = invoice.supplier_tva_num.replace(/\s/g, "").toUpperCase();
    if (!/^FR[A-Z0-9]{2}\d{9}$/.test(tva)) {
      issues.push({
        code: "INVALID_TVA_NUMBER",
        message: `N° TVA invalide "${invoice.supplier_tva_num}" — format attendu: FR + 2 caractères + 9 chiffres`,
        severity: "warning",
      });
    }
  }

  // Montants obligatoires
  if (invoice.amount_ht == null) {
    issues.push({ code: "MISSING_HT", message: "Montant HT manquant", severity: "error" });
  }
  if (invoice.tva_amount == null) {
    issues.push({ code: "MISSING_TVA", message: "Montant TVA manquant", severity: "error" });
  }
  if (invoice.amount_ttc == null) {
    issues.push({ code: "MISSING_TTC", message: "Montant TTC manquant", severity: "error" });
  }

  // Taux de TVA valide pour la France
  if (invoice.tva_rate != null) {
    if (!VALID_TVA_RATES.includes(invoice.tva_rate as typeof VALID_TVA_RATES[number])) {
      issues.push({
        code: "INVALID_TVA_RATE",
        message: `Taux de TVA ${invoice.tva_rate}% inhabituel (taux français: 0%, 2.1%, 5.5%, 10%, 20%)`,
        severity: "warning",
      });
    }
  }

  // Cohérence HT + TVA = TTC
  if (invoice.amount_ht && invoice.tva_amount && invoice.amount_ttc) {
    const computed = invoice.amount_ht + invoice.tva_amount;
    if (Math.abs(computed - invoice.amount_ttc) > 0.10) {
      issues.push({
        code: "TTC_MISMATCH",
        message: `Incohérence: ${invoice.amount_ht}€ HT + ${invoice.tva_amount}€ TVA ≠ ${invoice.amount_ttc}€ TTC`,
        severity: "warning",
      });
    }
  }

  return issues;
}

export function complianceScore(issues: ComplianceIssue[]): "ok" | "warning" | "error" {
  if (issues.some((i) => i.severity === "error")) return "error";
  if (issues.some((i) => i.severity === "warning")) return "warning";
  return "ok";
}

// Days overdue (positive = late)
export function daysOverdue(invoice: Pick<Invoice, "due_date" | "invoice_date" | "payment_terms_days" | "payment_status">): number | null {
  if (invoice.payment_status === "paid") return null;

  let deadline: Date | null = null;
  if (invoice.due_date) {
    deadline = new Date(invoice.due_date);
  } else if (invoice.invoice_date) {
    deadline = new Date(invoice.invoice_date);
    deadline.setDate(deadline.getDate() + (invoice.payment_terms_days ?? 30));
  }
  if (!deadline) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - deadline.getTime()) / (1000 * 86400));
}

// Pénalités de retard (French law: ECB rate + 10 points, min ~14.47% /year + 40€ flat fee)
export function computePenalties(amountTTC: number, daysLate: number): { interest: number; flatFee: number; total: number } {
  const annualRate = 0.1447; // ECB rate (≈4.47%) + 10 points
  const interest = amountTTC * annualRate * (daysLate / 365);
  const flatFee = 40; // indemnité forfaitaire obligatoire
  return {
    interest: Math.round(interest * 100) / 100,
    flatFee,
    total: Math.round((interest + flatFee) * 100) / 100,
  };
}
