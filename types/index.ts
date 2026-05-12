export type UserRole = "admin" | "worker";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  total_budget: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  budget_categories?: BudgetCategory[];
}

export type CategorySlug =
  | "materiaux"
  | "main_oeuvre"
  | "materiel"
  | "sous_traitants"
  | "divers";

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  materiaux: "Matériaux",
  main_oeuvre: "Main-d'œuvre",
  materiel: "Matériel",
  sous_traitants: "Sous-traitants",
  divers: "Divers",
};

export const CATEGORY_COLORS: Record<CategorySlug, string> = {
  materiaux: "#3b82f6",
  main_oeuvre: "#10b981",
  materiel: "#f59e0b",
  sous_traitants: "#8b5cf6",
  divers: "#6b7280",
};

export interface BudgetCategory {
  id: string;
  project_id: string;
  name: string;
  slug: CategorySlug;
  budget_amount: number;
  alert_threshold_pct: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  siret: string | null;
  tva_number: string | null;
  address: string | null;
  created_at: string;
}

export type OcrStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "needs_review";

export type InvoiceStatus = "pending" | "validated" | "rejected";

export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface TvaBreakdownItem {
  rate: number;
  base_ht: number;
  tva: number;
}

export interface Invoice {
  id: string;
  project_id: string;
  category_id: string | null;
  supplier_id: string | null;
  uploaded_by: string;
  image_path: string;
  ocr_status: OcrStatus;
  ocr_confidence: number | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  supplier_name: string | null;
  supplier_siret: string | null;
  supplier_tva_num: string | null;
  supplier_address: string | null;
  amount_ht: number | null;
  tva_rate: number | null;
  tva_amount: number | null;
  amount_ttc: number | null;
  tva_breakdown: TvaBreakdownItem[] | null;
  is_validated: boolean;
  validated_by: string | null;
  validated_at: string | null;
  notes: string | null;
  payment_status: PaymentStatus;
  payment_date: string | null;
  work_type: WorkType | null;
  payment_terms_days: number;
  compliance_issues: ComplianceIssue[] | null;
  created_at: string;
  updated_at: string;
  // Relations
  projects?: Pick<Project, "id" | "name">;
  budget_categories?: Pick<BudgetCategory, "id" | "name" | "slug">;
  profiles?: Pick<Profile, "id" | "full_name">;
}

// ─── French compliance ────────────────────────────────────────────────────────

export type WorkType =
  | "neuf"
  | "renovation"
  | "renovation_energetique"
  | "entretien"
  | "autre";

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  neuf: "Construction neuve",
  renovation: "Rénovation",
  renovation_energetique: "Rénovation énergétique",
  entretien: "Entretien / Réparation",
  autre: "Autre",
};

// TVA rates by work type (French law)
export const WORK_TYPE_TVA: Record<WorkType, number> = {
  neuf: 20,
  renovation: 10,
  renovation_energetique: 5.5,
  entretien: 10,
  autre: 20,
};

export const VALID_TVA_RATES = [0, 2.1, 5.5, 10, 20] as const;

export interface ComplianceIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export type AlertType =
  | "budget_threshold"
  | "budget_exceeded"
  | "unusual_amount"
  | "duplicate_invoice"
  | "ocr_failed"
  | "payment_overdue";

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  project_id: string;
  category_id: string | null;
  invoice_id: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  read_by: string | null;
  read_at: string | null;
  created_at: string;
  // Relations
  projects?: Pick<Project, "id" | "name">;
}

export interface BudgetSummary {
  category_id: string;
  project_id: string;
  category_name: string;
  category_slug: CategorySlug;
  budget_amount: number;
  alert_threshold_pct: number;
  actual_ht: number;
  pending_ht: number;
  invoice_count: number;
  pct_used: number;
}

export type DevisStatus = "brouillon" | "envoye" | "accepte" | "refuse" | "expire";

export const DEVIS_STATUS_LABELS: Record<DevisStatus, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

export const DEVIS_STATUS_COLORS: Record<DevisStatus, string> = {
  brouillon: "gray",
  envoye: "blue",
  accepte: "green",
  refuse: "red",
  expire: "orange",
};

export type DevisItemType = "main_oeuvre" | "materiaux" | "sous_traitance" | "materiel" | "forfait";

export const DEVIS_ITEM_TYPE_LABELS: Record<DevisItemType, string> = {
  main_oeuvre: "Main-d'œuvre",
  materiaux: "Matériaux",
  sous_traitance: "Sous-traitance",
  materiel: "Matériel",
  forfait: "Forfait",
};

export interface DevisItem {
  id: string;
  devis_id: string;
  position: number;
  type: DevisItemType;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  tva_rate: number;
  line_ht: number;
  line_tva: number;
  line_ttc: number;
  created_at: string;
}

export interface Devis {
  id: string;
  number: string;
  project_id: string | null;
  client_name: string;
  client_address: string | null;
  client_email: string | null;
  title: string;
  description: string | null;
  valid_until: string | null;
  status: DevisStatus;
  notes: string | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  devis_items?: DevisItem[];
  projects?: Pick<Project, "id" | "name">;
}

export interface ExtractedInvoice {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  supplier_name: string | null;
  supplier_siret: string | null;
  supplier_tva_number: string | null;
  supplier_address: string | null;
  amount_ht: number | null;
  tva_rate: number | null;
  tva_amount: number | null;
  amount_ttc: number | null;
  tva_breakdown: TvaBreakdownItem[] | null;
  confidence: number;
  extraction_notes: string | null;
}
