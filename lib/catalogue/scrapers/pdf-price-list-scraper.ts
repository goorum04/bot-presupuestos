import { getAnthropicClient } from "@/lib/openai/client";
import type { SupplierScraper, ScraperResult, ScrapedProduct } from "./base-scraper";

export class PdfPriceListScraper implements SupplierScraper {
  supplierId: string;
  private pdfUrl: string;

  constructor(supplierId: string, pdfUrl: string) {
    this.supplierId = supplierId;
    this.pdfUrl = pdfUrl;
  }

  async scrape(): Promise<ScraperResult> {
    let pdfBuffer: Buffer;
    try {
      const res = await fetch(this.pdfUrl, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        return { products: [], source_url: this.pdfUrl, error: `HTTP ${res.status}` };
      }
      pdfBuffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      return {
        products: [],
        source_url: this.pdfUrl,
        error: err instanceof Error ? err.message : "PDF fetch failed",
      };
    }

    const client = getAnthropicClient();
    const base64 = pdfBuffer.toString("base64");

    let responseText: string;
    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              {
                type: "text",
                text: `Extract all product/material price list entries from this PDF.
Return ONLY a JSON array (no markdown, no explanation) with this schema:
[{"reference":"...","name":"...","unit":"...","unit_price_ht":0.00,"category_slug":"..."}]

Rules:
- reference: product code/SKU if visible, else null
- name: full product name
- unit: unit of measure (u, m², m³, ml, kg, sac, t, h, etc.)
- unit_price_ht: numeric price excluding tax, null if not visible
- category_slug: best match from: ciment_beton, ferraillage, bois_charpente, isolation, carrelage, peinture, plomberie, electricite, menuiserie, toiture, enduits_mortiers, etancheite, quincaillerie, terrassement, prefabriques, facades, sanitaires, chauffage_ventil, outils_location, echafaudage
Output only the JSON array.`,
              },
            ],
          },
        ],
      });

      const block = msg.content.find((b) => b.type === "text");
      responseText = block && block.type === "text" ? block.text : "[]";
    } catch (err) {
      return {
        products: [],
        source_url: this.pdfUrl,
        error: err instanceof Error ? err.message : "Anthropic API error",
      };
    }

    let products: ScrapedProduct[] = [];
    try {
      const raw = JSON.parse(responseText.trim()) as Array<{
        reference?: string;
        name: string;
        unit: string;
        unit_price_ht?: number | null;
        category_slug?: string;
      }>;
      products = raw
        .filter((r) => r.name && r.unit)
        .map((r) => ({
          reference: r.reference ?? undefined,
          name: r.name,
          unit: r.unit,
          unit_price_ht: r.unit_price_ht ?? undefined,
          category_slug: r.category_slug ?? undefined,
        }));
    } catch {
      return { products: [], source_url: this.pdfUrl, error: "Failed to parse Anthropic response" };
    }

    return { products, source_url: this.pdfUrl };
  }
}
