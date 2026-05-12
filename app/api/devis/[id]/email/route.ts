import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import type { Devis, DevisItem } from "@/types";
import { DEVIS_ITEM_TYPE_LABELS } from "@/types";
import { formatEUR } from "@/lib/utils";

function buildHtml(devis: Devis, items: DevisItem[]): string {
  const rows = items
    .map(
      (it) => `
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:6px 8px">${it.description}<br><small style="color:#9ca3af">${DEVIS_ITEM_TYPE_LABELS[it.type]}</small></td>
        <td style="padding:6px 8px;text-align:center">${it.quantity} ${it.unit}</td>
        <td style="padding:6px 8px;text-align:right">${formatEUR(it.unit_price_ht)}</td>
        <td style="padding:6px 8px;text-align:center;color:#6b7280">${it.tva_rate}%</td>
        <td style="padding:6px 8px;text-align:right;font-weight:600">${formatEUR(it.line_ttc)}</td>
      </tr>`
    )
    .join("");

  const validUntil = devis.valid_until
    ? new Date(devis.valid_until).toLocaleDateString("fr-FR")
    : null;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Devis ${devis.number}</title></head>
<body style="font-family:Arial,sans-serif;color:#1a1a1a;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="background:#f59e0b;padding:20px 24px">
      <p style="margin:0;color:#fff;font-size:13px">DEVIS</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:22px">${devis.number}</h1>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px">Objet</p>
      <p style="margin:0 0 20px;font-size:16px;font-weight:600">${devis.title}</p>

      <p>Madame, Monsieur <strong>${devis.client_name}</strong>,</p>
      <p>Veuillez trouver ci-dessous notre devis pour les travaux demandés.</p>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
        <thead>
          <tr style="background:#f59e0b;color:#fff">
            <th style="padding:8px;text-align:left">Désignation</th>
            <th style="padding:8px;text-align:center">Qté</th>
            <th style="padding:8px;text-align:right">PU HT</th>
            <th style="padding:8px;text-align:center">TVA</th>
            <th style="padding:8px;text-align:right">Total TTC</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="text-align:right;font-size:13px;margin-top:8px">
        <p style="color:#6b7280;margin:4px 0">Total HT : ${formatEUR(devis.total_ht)}</p>
        <p style="color:#6b7280;margin:4px 0">Total TVA : ${formatEUR(devis.total_tva)}</p>
        <p style="font-size:16px;font-weight:700;margin:8px 0;border-top:2px solid #111;padding-top:8px">
          TOTAL TTC : ${formatEUR(devis.total_ttc)}
        </p>
      </div>

      ${validUntil ? `<p style="color:#6b7280;font-size:12px;margin-top:16px">Ce devis est valable jusqu'au <strong>${validUntil}</strong>.</p>` : ""}
      ${devis.notes ? `<div style="background:#f9fafb;border-radius:6px;padding:12px 16px;margin-top:16px;font-size:12px;color:#4b5563">${devis.notes}</div>` : ""}

      <p style="margin-top:24px">Pour accepter ce devis, veuillez nous retourner ce message avec la mention <strong>« Bon pour accord »</strong>.</p>
      <p>Cordialement,<br><strong>PresupuestoPro BTP</strong></p>
    </div>
    <div style="background:#f3f4f6;padding:12px 24px;font-size:10px;color:#9ca3af;text-align:center">
      TVA applicable selon art. 279-0 bis CGI
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured. Add it to your environment variables." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devis")
    .select("*, devis_items(*)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const devis = data as Devis & { devis_items: DevisItem[] };
  if (!devis.client_email) {
    return NextResponse.json({ error: "Aucun email client renseigné." }, { status: 400 });
  }

  const items = [...devis.devis_items].sort((a, b) => a.position - b.position);
  const resend = new Resend(apiKey);

  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to: devis.client_email,
    subject: `Devis ${devis.number} — ${devis.title}`,
    html: buildHtml(devis, items),
  });

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  // Mark as sent if still brouillon
  if (devis.status === "brouillon") {
    await supabase.from("devis").update({ status: "envoye" }).eq("id", id);
  }

  return NextResponse.json({ success: true });
}
