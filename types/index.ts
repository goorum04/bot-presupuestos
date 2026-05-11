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
  created_at: string;
  updated_at: string;
  // Relations
  projects?: Pick<Project, "id" | "name">;
  budget_categories?: Pick<BudgetCategory, "id" | "name" | "slug">;
  profiles?: Pick<Profile, "id" | "full_name">;
}

export type AlertType =
  | "budget_threshold"
  | "budget_exceeded"
  | "unusual_amount"
  | "duplicate_invoice"
  | "ocr_failed";

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
