import type { SupabaseClient } from "@supabase/supabase-js";
import { formatEUR } from "@/lib/utils";

interface AlertInsert {
  project_id: string;
  category_id?: string | null;
  invoice_id?: string | null;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

async function recentAlertExists(
  supabase: SupabaseClient,
  projectId: string,
  categoryId: string,
  type: string,
  withinHours = 24
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("alerts")
    .select("id")
    .eq("project_id", projectId)
    .eq("category_id", categoryId)
    .eq("type", type)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function evaluateAlerts(
  projectId: string,
  categoryId: string | null,
  invoiceId: string,
  supabase: SupabaseClient
): Promise<void> {
  const pending: AlertInsert[] = [];

  // --- 1. Budget threshold / exceeded ---
  if (categoryId) {
    const { data: cat } = await supabase
      .from("budget_categories")
      .select("name, budget_amount, alert_threshold_pct")
      .eq("id", categoryId)
      .single();

    const { data: spent } = await supabase
      .from("invoices")
      .select("amount_ht")
      .eq("category_id", categoryId)
      .eq("is_validated", true)
      .neq("ocr_status", "failed");

    if (cat && spent) {
      const totalSpent = spent.reduce(
        (sum, r) => sum + (r.amount_ht ?? 0),
        0
      );
      const pct = cat.budget_amount > 0 ? (totalSpent / cat.budget_amount) * 100 : 0;

      if (pct >= 100) {
        const alreadyAlerted = await recentAlertExists(
          supabase, projectId, categoryId, "budget_exceeded", 48
        );
        if (!alreadyAlerted) {
          pending.push({
            project_id: projectId,
            category_id: categoryId,
            invoice_id: invoiceId,
            type: "budget_exceeded",
            severity: "critical",
            title: `Budget dépassé: ${cat.name}`,
            message: `La catégorie "${cat.name}" a dépassé son budget de ${formatEUR(totalSpent - cat.budget_amount)}.`,
            metadata: { pct_used: pct, actual_ht: totalSpent, budget_amount: cat.budget_amount },
          });
        }
      } else if (pct >= (cat.alert_threshold_pct ?? 80)) {
        const alreadyAlerted = await recentAlertExists(
          supabase, projectId, categoryId, "budget_threshold", 24
        );
        if (!alreadyAlerted) {
          pending.push({
            project_id: projectId,
            category_id: categoryId,
            invoice_id: invoiceId,
            type: "budget_threshold",
            severity: "warning",
            title: `Seuil d'alerte: ${cat.name}`,
            message: `La catégorie "${cat.name}" a consommé ${pct.toFixed(1)}% de son budget (${formatEUR(totalSpent)} / ${formatEUR(cat.budget_amount)}).`,
            metadata: { pct_used: pct, threshold: cat.alert_threshold_pct },
          });
        }
      }
    }
  }

  // --- 2. Duplicate invoice detection ---
  const { data: inv } = await supabase
    .from("invoices")
    .select("invoice_number, supplier_siret, amount_ht")
    .eq("id", invoiceId)
    .single();

  if (inv?.invoice_number && inv?.supplier_siret) {
    const { data: dupe } = await supabase
      .from("invoices")
      .select("id")
      .eq("invoice_number", inv.invoice_number)
      .eq("supplier_siret", inv.supplier_siret)
      .eq("project_id", projectId)
      .neq("id", invoiceId)
      .maybeSingle();

    if (dupe) {
      pending.push({
        project_id: projectId,
        category_id: categoryId,
        invoice_id: invoiceId,
        type: "duplicate_invoice",
        severity: "critical",
        title: "Doublon détecté",
        message: `La facture n°${inv.invoice_number} du fournisseur (SIRET: ${inv.supplier_siret}) existe déjà dans ce chantier.`,
        metadata: { duplicate_id: dupe.id },
      });
    }
  }

  // --- 3. Unusual amount (statistical outlier) ---
  if (categoryId && inv?.amount_ht) {
    const { data: others } = await supabase
      .from("invoices")
      .select("amount_ht")
      .eq("category_id", categoryId)
      .eq("ocr_status", "completed")
      .neq("id", invoiceId)
      .not("amount_ht", "is", null);

    if (others && others.length >= 4) {
      const amounts = others.map((r) => r.amount_ht as number);
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stddev = Math.sqrt(
        amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length
      );
      const zScore = stddev > 0 ? Math.abs((inv.amount_ht - mean) / stddev) : 0;

      if (zScore > 2.5) {
        pending.push({
          project_id: projectId,
          category_id: categoryId,
          invoice_id: invoiceId,
          type: "unusual_amount",
          severity: "warning",
          title: "Montant inhabituel",
          message: `Cette facture de ${formatEUR(inv.amount_ht)} est significativement différente de la moyenne (${formatEUR(mean)}).`,
          metadata: { amount: inv.amount_ht, mean, stddev, z_score: zScore },
        });
      }
    }
  }

  if (pending.length > 0) {
    await supabase.from("alerts").insert(pending);
  }
}
