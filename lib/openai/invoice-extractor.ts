import { getOpenAIClient } from "./client";
import type { ExtractedInvoice } from "@/types";

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'extraction de données de factures françaises.
Tu reçois une image de facture et tu dois extraire les informations structurées.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.

Champs à extraire:
- invoice_number: numéro de facture (string ou null)
- invoice_date: date au format ISO 8601 YYYY-MM-DD (string ou null)
- due_date: date d'échéance au format YYYY-MM-DD (string ou null)
- supplier_name: raison sociale du fournisseur (string ou null)
- supplier_siret: numéro SIRET à 14 chiffres sans espaces (string ou null)
- supplier_tva_number: numéro TVA intracommunautaire ex FR12345678901 (string ou null)
- supplier_address: adresse complète du fournisseur (string ou null)
- amount_ht: montant hors taxes en nombre décimal (number ou null)
- tva_rate: taux de TVA principal en pourcentage 20, 10, 5.5, 2.1 ou 0 (number ou null)
- tva_amount: montant de la TVA en nombre décimal (number ou null)
- amount_ttc: montant toutes taxes comprises en nombre décimal (number ou null)
- tva_breakdown: tableau si plusieurs taux de TVA, sinon null. Format: [{"rate": 20, "base_ht": 1000.00, "tva": 200.00}]
- confidence: niveau de confiance global entre 0 et 1 (number)
- extraction_notes: notes sur les difficultés d'extraction (string ou null)

Règles:
- Taux TVA courants en France: 20% standard, 10% travaux, 5.5% rénovation énergétique
- SIRET: 14 chiffres exactement (SIREN 9 + NIC 5)
- Champs manquants ou illisibles → null
- Ne jamais inventer des données non présentes sur la facture
- Montants en nombres décimaux avec point (pas de virgule, pas de symbole €)`;

export async function extractInvoiceData(
  imageUrl: string
): Promise<ExtractedInvoice> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
          {
            type: "text",
            text: "Extrais les données de cette facture française.",
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("GPT-4o returned empty response");

  const parsed = JSON.parse(raw) as ExtractedInvoice;

  // Normalize SIRET: strip spaces
  if (parsed.supplier_siret) {
    parsed.supplier_siret = parsed.supplier_siret.replace(/\s/g, "");
    if (parsed.supplier_siret.length !== 14) {
      parsed.supplier_siret = null;
    }
  }

  // Cross-check: HT + TVA ≈ TTC
  if (parsed.amount_ht && parsed.tva_amount && parsed.amount_ttc) {
    const computed = parsed.amount_ht + parsed.tva_amount;
    if (Math.abs(computed - parsed.amount_ttc) > 0.05) {
      parsed.extraction_notes = [
        parsed.extraction_notes,
        `Incohérence: ${parsed.amount_ht} + ${parsed.tva_amount} ≠ ${parsed.amount_ttc}`,
      ]
        .filter(Boolean)
        .join(". ");
    }
  }

  // Ensure confidence is in [0,1]
  if (typeof parsed.confidence !== "number") {
    parsed.confidence = 0.5;
  }
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

  return parsed;
}
